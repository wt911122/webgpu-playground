
class Font {
    fontFamily = '';
    fontjson = undefined;
    imageBitmaps = undefined;

    constructor(fontFamily, url) {
        this.fontFamily = fontFamily;
        this.url = url;
    }

    async load(device) {
        const url = this.url;
        const fontFamily = this.fontFamily;
        const response = await fetch(`${url}${fontFamily}.json`);
        const json = await response.json();

        const imageBitmaps = await Promise.all(json.pages.map(async (imageName) => {
            const response = await fetch(`${url}${imageName}`);
            const imageBitmap = await createImageBitmap(await response.blob());
            return imageBitmap;
        }))
        
        const charCount = json.chars.length;
        const charsBuffer = device.createBuffer({
            label: 'MSDF character layout buffer',
            size: charCount * Float32Array.BYTES_PER_ELEMENT * 10,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });

        const charsArray = new Float32Array(charsBuffer.getMappedRange());

        const u = 1 / json.common.scaleW;
        const v = 1 / json.common.scaleH;

        const chars = {};

        let offset = 0;
        for (const [i, char] of json.chars.entries()) {
            chars[char.id] = char;
            chars[char.id].charIndex = i;
            charsArray[offset] = char.x * u; // texOffset.x
            charsArray[offset + 1] = char.y * v; // texOffset.y
            charsArray[offset + 2] = char.width * u; // texExtent.x
            charsArray[offset + 3] = char.height * v; // texExtent.y
            charsArray[offset + 4] = char.width; // size.x
            charsArray[offset + 5] = char.height; // size.y
            charsArray[offset + 6] = char.xoffset; // offset.x
            charsArray[offset + 7] = -char.yoffset; // offset.y
            charsArray[offset + 8] = char.page; // page
            offset += 10;
        }

        charsBuffer.unmap();

        const textureMap = device.createTexture({
            label: `MSDF font texture ${this.fontFamily}`,
            size: {
                width: json.common.scaleW,
                height: json.common.scaleH,
                depthOrArrayLayers: imageBitmaps.length,
            },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        json.pages.forEach((url, idx) => {
            const imageBitmap = imageBitmaps[idx];
            // const texture = device.createTexture({
            //     label: `MSDF font texture ${url}`,
            //     size: [imageBitmap.width, imageBitmap.height, 1],
            //     format: 'rgba8unorm',
            //     usage:
            //         GPUTextureUsage.TEXTURE_BINDING |
            //         GPUTextureUsage.COPY_DST |
            //         GPUTextureUsage.RENDER_ATTACHMENT,
            //     });
            device.queue.copyExternalImageToTexture(
                { source: imageBitmap },
                { texture: textureMap, origin: { x: 0, y: 0, z: idx }  },
                [imageBitmap.width, imageBitmap.height]
            );
            // return texture;
        });

        const kernings = new Map();

        if (json.kernings) {
            for (const kearning of json.kernings) {
                let charKerning = kernings.get(kearning.first);
                if (!charKerning) {
                    charKerning = new Map();
                    kernings.set(kearning.first, charKerning);
                }
                charKerning.set(kearning.second, kearning.amount);
            }
        }
        const charArray = Object.values(chars);

        const sampler = device.createSampler({
            label: 'MSDF text sampler',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
            maxAnisotropy: 16,
        })

        const fontBindGroupLayout = device.createBindGroupLayout({
            label: 'MSDF text group layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: '2d-array',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' },
                },
            ]
        })

        const bindGroup = device.createBindGroup({
            label: 'msdf font bind group',
            layout: fontBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    // TODO: Allow multi-page fonts
                    resource: textureMap.createView({
                        dimension: '2d-array', 
                        baseArrayLayer: 0,
                        arrayLayerCount: imageBitmaps.length,
                    }),
                    
                },
                {
                    binding: 1,
                    resource: sampler,
                },
                {
                    binding: 2,
                    resource: { buffer: charsBuffer },
                },
            ],
        });

        this.fontjson = json;
        this.lineHeight = json.common.lineHeight;
        this.kernings = kernings;
        this.bindGroup = bindGroup;
        this.fontBindGroupLayout = fontBindGroupLayout;
        this.chars = chars;
        this.charCount = charArray.length;
        this.defaultChar = charArray[0];
    }

    getChar(charCode) {
        let char = this.chars[charCode];
        if (!char) {
            char = this.defaultChar;
        }
        return char;
    }
    getXAdvance(charCode, nextCharCode = -1) {
        const char = this.getChar(charCode);
        if (nextCharCode >= 0) {
            const kerning = this.kernings.get(charCode);
            if (kerning) {
                return char.xadvance + (kerning.get(nextCharCode) ?? 0);
            }
        }
        return char.xadvance;
    }
}

class FontRegistry {
    _fonts = new Map();

    regist(fontFamily, url) {
        const f = new Font(fontFamily, url);
        this._fonts.set(fontFamily, f);
        return f;
    }

    async load(device) {
        const loadingpanel = document.createElement('div');
        loadingpanel.style = 'position: absolute; right: 20px; top: 20px;';
        document.body.append(loadingpanel);
        await Promise.all(Array.from(this._fonts).map(async ([fontFamily, font]) => {
            const elem = document.createElement('div');
            loadingpanel.append(elem);
            elem.innerHTML = `加载字体${font.fontFamily}`;
            await font.load(device);
            elem.innerHTML = `字体${font.fontFamily}加载完成`;
        }));
        loadingpanel.remove();
    }

    getFont(fontFamily) {
        return this._fonts.get(fontFamily)
    }
}

export default FontRegistry;