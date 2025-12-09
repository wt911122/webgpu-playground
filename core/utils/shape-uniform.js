
const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;

export function prepareUniform(device, {
    MAX_OBJECTS,
    uniformBufferSize,
    bindGroupLayout,
    context,
    noGlobal = false,
    bindNumber = 2,
    label = ''
}) {
    
    const uniformBufferSpace = roundUp(uniformBufferSize, device.limits.minUniformBufferOffsetAlignment);
    const uniformBuffer = device.createBuffer({
        label: 'uniforms',
        size: uniformBufferSpace * MAX_OBJECTS,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const mappedTransferBuffers = [];
    const getMappedTransferBuffer = () => {
        return mappedTransferBuffers.pop() || device.createBuffer({
            label: `${label} transfer buffer`,
            size: uniformBufferSpace * MAX_OBJECTS,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
    };
    const cacheTransferBuffer = (buff) => {
        mappedTransferBuffers.push(buff);
    } 
    const bindGroups = [];
    const globalBinds = [
        { binding: 0, resource: { buffer: context.worldUniformBuffer } },
        { binding: 1, resource: { buffer: context.shapeUniformBuffer } },
    ]
    for (let i = 0; i < MAX_OBJECTS; ++i) {
        const uniformBufferOffset = i * uniformBufferSpace;
        const bindGroup =  device.createBindGroup({
            label: 'bindingGroup',
            layout: bindGroupLayout,
            entries: [
                ...(noGlobal ? []: globalBinds),
                { binding: bindNumber, resource: { buffer: uniformBuffer,  offset: uniformBufferOffset, size: uniformBufferSize } },
            ],
        });
        bindGroups.push(bindGroup)
    }

    function prepareRender(encoder, numObjects) {
        const transferBuffer = getMappedTransferBuffer();
        const uniformValues = new Float32Array(transferBuffer.getMappedRange());
        const size = (numObjects - 1) * uniformBufferSpace + uniformBufferSize;
        encoder.copyBufferToBuffer(transferBuffer, 0, uniformBuffer, 0, size);
        return { uniformValues, transferBuffer };
    }

    return {
        uniformBufferSpace,
        bindGroups,
        prepareRender,
        cacheTransferBuffer
    }

}


export function createFloatBufferAtCreate(label, device, usage, arr, size) {
    const _size = size || roundUp(arr.length * Float32Array.BYTES_PER_ELEMENT, 4);
    const buffer = device.createBuffer({
        label,
        size: _size,
        usage,
        mappedAtCreation: true,
    });
    const t = new Float32Array(buffer.getMappedRange());
    t.set(arr);
    buffer.unmap();
    return buffer;
}

export function createUnit16BufferAtCreate(label, device, usage, arr, size) {
    const _size = size || roundUp(arr.length * Uint16Array.BYTES_PER_ELEMENT, 4); 
    const buffer = device.createBuffer({
        label,
        size: _size,
        usage,
        mappedAtCreation: true,
    });
    const t = new Uint16Array(buffer.getMappedRange());
    t.set(arr);
    buffer.unmap();
    return buffer;
}
