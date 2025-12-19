function createTextureFromSource(device, source, options = {}) {
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

export function createSampler(device) {
    const sampler = device.createSampler({
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
    });
    return sampler;
}

export function prepareTexture(device, source, sampler) {
    const textureBindGroupLayout = device.createBindGroupLayout({
        label: 'texture bindgroup layout',
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    viewDimension: '2d',
                },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {},
            },
            { 
                binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                buffer: { type: 'uniform', minBindingSize: 16 },
            },
        ],
    });
    const texture = createTextureFromSource(device, source);
    const uniformBuffer = device.createBuffer({
        label: 'uniforms',
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    const uniformValues = new Float32Array(uniformBuffer.getMappedRange());
    uniformValues[0] = source.width;
    uniformValues[1] = source.height;
    uniformBuffer.unmap();
    const bindGroup = device.createBindGroup({
        layout: textureBindGroupLayout,
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: texture.createView() },
            { binding: 2, resource: { buffer: uniformBuffer }},
        ],
    });

    return {
        bindGroup
    }
}

