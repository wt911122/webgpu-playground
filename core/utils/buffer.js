export function createBufferWithData(device, data, usage) {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: usage,
        mappedAtCreation: true,
    });
    const dst = new Uint8Array(buffer.getMappedRange());
    dst.set(new Uint8Array(data.buffer));
    buffer.unmap();
    return buffer;
}