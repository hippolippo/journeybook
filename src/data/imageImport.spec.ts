import { describe, expect, it } from 'vitest';
import { isConvertibleFormat } from './imageImport';

function fakeFile(name: string, type: string) {
  return new File([new Uint8Array()], name, { type });
}

describe('isConvertibleFormat', () => {
  it('detects HEIC/HEIF by MIME type', () => {
    expect(isConvertibleFormat(fakeFile('a.heic', 'image/heic'))).toBe(true);
    expect(isConvertibleFormat(fakeFile('a.heif', 'image/heif'))).toBe(true);
  });

  it('detects HEIC/HEIF by extension when the type is missing', () => {
    expect(isConvertibleFormat(fakeFile('IMG_1234.HEIC', ''))).toBe(true);
  });

  it('leaves natively supported formats alone', () => {
    expect(isConvertibleFormat(fakeFile('a.jpg', 'image/jpeg'))).toBe(false);
    expect(isConvertibleFormat(fakeFile('a.png', 'image/png'))).toBe(false);
    expect(isConvertibleFormat(fakeFile('a.webp', 'image/webp'))).toBe(false);
  });
});
