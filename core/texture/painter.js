export function TexturePainter(device) {

    const textureBindGroupLayout = device.createBindGroupLayout({
        label: 'texture bindgroup layout',
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                texture: {
                    viewDimension: '2d',
                },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {},
            }
        ],
    });

    const sampler = device.createSampler({
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
    });

    function createTextureSource(source, options = {}) {
        const texture = device.createTexture({
            format: 'rgba8unorm',
            mipLevelCount: 1, // options.mips ? numMipLevels(source.width, source.height) : 1,
            size: [source.width, source.height],
            usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture(
            { source },
            { texture },
            { width: source.width, height: source.height },
        );
        return texture;
    }

    function prepareBindGroup(texture) {
        const bindGroup = device.createBindGroup({
            layout: textureBindGroupLayout,
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: sampler }
            ],
        });
        return bindGroup;
    }

    const defaultTexture = (function() {
        const textureData = new Uint8Array([0, 0, 0, 0]);
        const texture = device.createTexture({
            format: 'rgba8unorm',
            mipLevelCount: 1, // options.mips ? numMipLevels(source.width, source.height) : 1,
            size: [1, 1],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        device.queue.writeTexture(
            { texture },
            textureData,
            { bytesPerRow: 1 * 4 },
            { width: 1, height: 1 },
        );
        const bindGroup = device.createBindGroup({
            layout: textureBindGroupLayout,
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: sampler }
            ],
        });
        return {
            texture,
            bindGroup
        };
    })();
     
     

    return {
        defaultTexture,
        createTextureSource,
        sampler,
        textureBindGroupLayout,
        prepareBindGroup,
    }
}