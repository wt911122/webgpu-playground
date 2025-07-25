import vertexShader from './vertex.wgsl?raw';
import fragmentShader from './circle.wgsl?raw';

async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.getElementById('app').append(canvas);
    const context = canvas.getContext('webgpu');

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
    })
    
    // Resolution Buffer
    const ResolutionValue = new Float32Array([
        800, 600,
    ]);
    const ResolutionBuffer = device.createBuffer({
        label: 'resolutionBuffer',
        size: ResolutionValue.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(ResolutionBuffer, 0, ResolutionValue);
    // Vertex Buffer
    const Vertex = new Float32Array([
        -1, 1,
        1, 1,
        -1, -1,

        -1, -1, 
        1, 1, 
        1, -1
    ]);
    const VertexBuffer = device.createBuffer({
        label: 'Vertex',
        size: Vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(VertexBuffer, 0, Vertex);

    // Circle Buffer 
    const Circle = new Float32Array([
        100, 100, // cx, cy,
        100, // rx, ry,
    ]);
    const CircleBuffer = device.createBuffer({
        label: 'Vertex',
        size: Circle.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(CircleBuffer, 0, Circle);

    const numVertices = 6;
    const kNumObjects = 1;

    const renderPipeline = device.createRenderPipeline({
        label: 'per vertex color',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: vertexShader,
            }),
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 2 * 4,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' },
                    ],
                    stepMode: "vertex"
                },
                {
                    arrayStride: 3 * 4,
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: 'float32x2' },
                        { shaderLocation: 2, offset: 4, format: 'float32x2' },
                    ],
                    stepMode: "instance"
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({
                code: fragmentShader
            }),
            targets: [{ format: presentationFormat, }],
        },
    })

    const bindGroup = device.createBindGroup({
        label: 'bindingGroup',
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { 
                binding: 0, 
                resource: { buffer: ResolutionBuffer } 
            },
        ],
    });

    
    const encoder = device.createCommandEncoder();
    const passEncoder = encoder.beginRenderPass({
        colorAttachments: [
            {
                clearValue: { r: 0.0, g: 0.5, b: 1.0, a: 1.0},
                loadOp: "clear",
                storeOp: "store",
                view: context.getCurrentTexture().createView()
            }
        ]
    });
    passEncoder.setPipeline(renderPipeline);
    passEncoder.setVertexBuffer(0, VertexBuffer);
    passEncoder.setVertexBuffer(1, CircleBuffer);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(numVertices, kNumObjects)
    passEncoder.end();

    
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}

init();