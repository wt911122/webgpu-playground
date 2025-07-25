// import circleFrag from "./circle-frag.wgsl?raw';
// import vertexShader from "./vertex.wgsl?raw";

const circleFrag = `

struct Uniforms {
  resolution: vec4f,
}
@group(0) @binding(0) var<uniform> u: Uniforms;

struct CirleMeta {
    points: vec4f,
}
@group(0) @binding(1) var<uniform> circleMeta: CirleMeta;

fn sdCircle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}


struct VertexInput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
}

@fragment
fn main(fragData: VertexInput) -> @location(0) vec4f {
    // var center = vec2f(-0.125, -0.166666);
    // var center = vec2f(0, 0);
    var centerpoint = (circleMeta.points.xy - u.resolution.xy) / u.resolution.zw;
    var l = length(u.resolution.zw); // scalar
    var scale = u.resolution.zw / l;
    var d = sdCircle(
        fragData.fragPosition*scale-centerpoint*scale, 
        circleMeta.points.z/l);
    if(d > 0.0) {
        discard;
    }
    return vec4f(0.9,0.6,0.3, 1.0);
}
`
const vertexShader = 
`
struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
}

struct Uniforms {
  resolution: vec4f,
}
@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn main(
  @location(0) position : vec2f,
) -> VertexOutput {
    var output : VertexOutput;
    var p = (position.xy - u.resolution.xy) / u.resolution.zw;
    output.position = vec4f(p, 0.0, 1.0);
    output.fragPosition = p;
    return output;
}
`

async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

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

    const resolutionValue = new Float32Array([
        0, 0, 800, 600,
    ]);
    const resolutionBuffer = device.createBuffer({
        label: 'resolutionBuffer',
        size: resolutionValue.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
        resolutionBuffer, 0, 
        resolutionValue.buffer,
        resolutionValue.byteOffset,
        resolutionValue.byteLength
    );
    

    const vertices = new Float32Array([
        -300, 100,
        100, 100, 
        100, -300,
        
        100, -300,
        -300, -300,
        -300, 100,
    ]);

    const vertexBuffer = device.createBuffer({
        label: 'vertexBuffer',
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })

    device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

    const circleuniform = new Float32Array([
        -100, -100, 200, 0
    ])
    const circleBuffer = device.createBuffer({
        label: 'circleBuffer',
        size: circleuniform.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(
        circleBuffer, 0, 
        circleuniform.buffer,
        circleuniform.byteOffset,
        circleuniform.byteLength
    );

    console.log(vertexBuffer)

    // const bindGroupLayout = device.createBindGroupLayout({
    //     label: 'bindingGroupLayout',
    //     entries: [
    //         {
    //             binding: 0,
    //             visibility: GPUShaderStage.FRAGMENT,
    //             buffer: {},
    //         },
    //     ],
    // });

    const vertexModule = device.createShaderModule({
        code: vertexShader,
    });
    const shaderModule = device.createShaderModule({
        code: circleFrag
    });

    const renderPipeline = device.createRenderPipeline({
        label: 'renderPipeline',
        vertex: {
            module: vertexModule,
            entryPoint: "main",
            buffers: [
                {
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x2'
                        },
                    ],
                    arrayStride: 8,
                    stepMode: "vertex"
                }
            ]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "main",
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
    });

    const bindGroup = device.createBindGroup({
        label: 'bindingGroup',
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { 
                binding: 0, 
                resource: { buffer: resolutionBuffer } 
            },
            { 
                binding: 1, 
                resource: { buffer: circleBuffer } 
            },
        ],
    });

    console.log('commandEncoder init')
    const commandEncoder = device.createCommandEncoder();

    const clearColor = { r: 0.0, g: 0.5, b: 1.0, a: 1.0};

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
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(6)
    
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()])
}
init();