const shader = `
    struct VertexOut {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f
    }

    @vertex
    fn vertex_main(@location(0) position: vec4f,
                @location(1) color: vec4f) -> VertexOut
    {
        var output:VertexOut;
        output.position = position;
        output.color = color;
        return output;
    }
        

    @fragment
    fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
    {
        return fragData.color;
    }
    `

async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();


    const shaderModule = device.createShaderModule({
        code: shader,
    })

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.getElementById('app').append(canvas);
    const context = canvas.getContext('webgpu');

    context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied'
    })

    // {
        const vertices = new Float32Array([
            -1,  1,  0, 1,  1, 0, 0, 1,
            1,  1,  0, 1,  1, 0, 0, 1,
            1,  -1, 0, 1,  1, 0, 0, 1,

            1,  -1, 0, 1,  1, 0, 0, 1,
            -1,  -1, 0, 1,  1, 0, 0, 1,
            -1, 1, 0, 1,  1, 0, 0, 1, 
        ]);

        const vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        })

        device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);
    // }

    // {
    //      const vertices2 = new Float32Array([
    //         0.5,  -0.6, 0, 1,  0, 1, 0, 1,
    //         -0.3,  -0.2, 0, 1,  0, 1, 0, 1,
    //         -0.4,  0.2, 0, 1,  0, 1, 0, 1, 
    //     ]);
    //     const vertexBuffer2 = device.createBuffer({
    //         size: vertices2.byteLength,
    //         usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    //     })
    //     device.queue.writeBuffer(vertexBuffer2, 0, vertices2, 0, vertices2.length);
    // }

    // {
    //     const x = 0;
    //     const y = 0;
    //     const r = 120;
    //     const slices = 
    //     const vertices2 = new Float32Array([
    //         0.5,  -0.6, 0, 1,  0, 1, 0, 1,
    //         -0.3,  -0.2, 0, 1,  0, 1, 0, 1,
    //         -0.4,  0.2, 0, 1,  0, 1, 0, 1, 
    //     ]);
    //     const vertexBuffer2 = device.createBuffer({
    //         size: vertices2.byteLength,
    //         usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    //     })
    //     device.queue.writeBuffer(vertexBuffer2, 0, vertices2, 0, vertices2.length);
    // }

   

    const vertexBuffers = [
        {
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x4'
                },
                {
                    shaderLocation: 1,
                    offset: 16,
                    format: 'float32x4'
                }
            ],
            arrayStride: 32,
            stepMode: "vertex"
        }
    ]

    const pipelineDescriptor = {
        vertex: {
            module: shaderModule,
            entryPoint: "vertex_main",
            buffers: vertexBuffers
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragment_main",
            targets: [
                { 
                    format: navigator.gpu.getPreferredCanvasFormat(),
                }
            ]
        },
        primitive: {
            topology: "triangle-list"
        },
        layout: "auto"
    }

    const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

    const commandEncoder = device.createCommandEncoder();

    const clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 0.0};

    const renderPassDescriptor = {
        colorAttachments: [
            {
                clearValue: clearColor,
                loadOp: "clear",
                storeOp: "store",
                view: context.getCurrentTexture().createView()
            }
        ]
    }

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(renderPipeline);

    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.draw(6)

    // passEncoder.setVertexBuffer(0, vertexBuffer2);
    // passEncoder.draw(3)
    
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()])
}
init()