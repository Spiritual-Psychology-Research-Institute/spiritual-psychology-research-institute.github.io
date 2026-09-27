// 메일로 온 사진을 사이트에 바로 쓸 수 있는 형태로 만든다.
//
// 휴대폰 사진은 3~8MB, 4000px 이 넘는다. 그대로 올리면 사이트가 느려지고,
// Claude 가 사진을 볼 때 토큰도 그만큼 든다. 여기서 한 번 줄여두면
// 사이트, 비용, 검사 세 곳이 모두 편해진다.
//
// - 긴 변 1600px, JPEG 로 통일 (아이폰 HEIC 포함)
// - 휴대폰 회전 정보대로 바로 세운다
// - 메타데이터(GPS 위치 포함)를 지운다. 이 저장소는 공개다.
import sharp from "sharp";

const MAX_EDGE = 1600;
// 서명에 박힌 로고나 아이콘은 사진이 아니다. 요청과 무관한 파일이
// 이슈에 섞이면 Claude 가 그걸 어디 넣으라는 건지 헷갈린다.
const MIN_EDGE = 200;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i;

export const isImage = (att) =>
  /^image\//i.test(att.contentType || "") || IMAGE_EXT.test(att.filename || "");

const isHeic = (att, buf) =>
  /hei[cf]/i.test(att.contentType || "") ||
  /\.hei[cf]$/i.test(att.filename || "") ||
  // ISO BMFF 'ftyp' 박스의 브랜드로 판별. 확장자 없이 오는 경우가 있다.
  /^(heic|heix|hevc|mif1|msf1)$/.test(buf.subarray(8, 12).toString("latin1"));

// sharp 의 기본 libvips 에는 HEVC 디코더가 없어 아이폰 HEIC 를 못 연다.
// 그때만 순수 JS 변환기로 한 번 JPEG 으로 푼 뒤 다시 처리한다.
const decodeHeic = async (buf) => {
  const { default: convert } = await import("heic-convert");
  return Buffer.from(await convert({ buffer: buf, format: "JPEG", quality: 0.92 }));
};

/**
 * @returns {Promise<{buffer: Buffer, width: number, height: number} | {skip: string}>}
 */
export async function prepareImage(att) {
  let input = att.content;

  const render = async (buf) => {
    const { data, info } = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  };

  let out;
  try {
    out = await render(input);
  } catch (e) {
    if (!isHeic(att, input)) return { skip: `사진을 열 수 없음 (${String(e.message).slice(0, 60)})` };
    try {
      out = await render(await decodeHeic(input));
    } catch (e2) {
      return { skip: `아이폰 사진(HEIC)을 변환하지 못함 (${String(e2.message).slice(0, 60)})` };
    }
  }

  if (out.width < MIN_EDGE && out.height < MIN_EDGE) {
    return { skip: `${out.width}×${out.height} 크기라 서명 아이콘으로 보고 건너뜀` };
  }
  return out;
}
