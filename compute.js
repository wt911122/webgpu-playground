// const NUM_ELEMENTS = 1000;
const BUFFER_SIZE = 1000

const shader = `
@group(0) @binding(0)
var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(
    @builtin(global_invocation_id)
    global_id : vec3u,

    @builtin(local_invocation_id)
    local_id: vec3u,
){
    if(global_id.x >= ${BUFFER_SIZE}u) {
        return;
    }
    output[global_id.x] = f32(global_id.x) * 1000. + f32(local_id.x);
}
`

async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const shaderModule = device.createShaderModule({
        code: shader,
    })
    const outputBuffer = device.createBuffer({
        label: 'outputBuffer',
        size: BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })

    const stagingBuffer = device.createBuffer({
        label: 'stagingBuffer',
        size: BUFFER_SIZE,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            }
        ]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: outputBuffer
                }
            }
        ]
    })

    const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }),
        compute: {
            module: shaderModule,
            entryPoint: "main"
        }
    })
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(BUFFER_SIZE/64))
    passEncoder.end();


    commandEncoder.copyBufferToBuffer(
        outputBuffer, 0, stagingBuffer, 0, BUFFER_SIZE
    )

    device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ, 0, BUFFER_SIZE);
    const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
    const data = copyArrayBuffer.slice();
    stagingBuffer.unmap();
    console.log(new Float32Array(data));
}
init();
