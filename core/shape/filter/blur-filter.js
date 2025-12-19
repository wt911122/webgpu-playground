// 此版本效果较差
import blurShader from './blur-shader.wgsl?raw';
import preBlurShader from './pre-blur-texture.wgsl?raw';
import { createFloatBufferAtCreate } from '../../utils/shape-uniform';

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
function createEmptyTexture(device, width, height) {
    const texture = device.createTexture({
        size: [width, height],
        format: presentationFormat,
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });
    return texture;
}
function createVertexBuffer(device, vertices) {
    const buffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, vertices);
    return buffer;
}

export function prepareFilter(device) {
    const blurModule = device.createShaderModule({
        code: blurShader,
    })
    const preBlurModule = device.createShaderModule({
        code: preBlurShader,
    })
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    const preBlurPipeline = device.createRenderPipeline({
        label: 'partPipeline textured quad pipeline',
        layout: 'auto',
        vertex: {
            module: preBlurModule,
        },
        fragment: {
            module: preBlurModule,
            targets: [{ format: presentationFormat }],
        },
    });


    const vertexBuffer = createVertexBuffer(device, new Float32Array([
        // pos(x,y) tex(u,v)

        // first triangle
        // top left 
        -1.0, 1.0, 0.0, 0.0,
        // top right
        1.0, 1.0, 1.0, 0.0,
        // bottom left 
        -1.0, -1.0, 0.0, 1.0,

        // second triangle
        // bottom left
        -1.0, -1.0, 0.0, 1.0,
        // top right
        1.0, 1.0, 1.0, 0.0,
        // bottom right
        1.0, -1.0, 1.0, 1.0
    ]));
    function createPipeline(fragmentEntryPoint) {
        return device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: blurModule,
            entryPoint: "vertexMain",
            buffers: [
                    {
                        arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x2"
                            },
                            {
                                shaderLocation: 1,
                                offset: 2 * Float32Array.BYTES_PER_ELEMENT,
                                format: "float32x2"
                            }
                        ]
                    }
                ]
            },
            fragment: {
                module: blurModule,
                entryPoint: fragmentEntryPoint,
                targets: [{ format: presentationFormat }],
            },
        })
    }

    const verticalBlurPipeline = createPipeline("fragmentMainVertical");
    const horizontalBlurPipeline =  createPipeline("fragmentMainHorizontal");
    
    

    function runFilter(inputTexture, options, originWidth, originHeight) {
        const blur = options.blur;
        const width = originWidth + blur*2;
        const height = originWidth + blur*2;

        const horizontalPassRenderTexture = createEmptyTexture(device, width, height);
        const verticalPassRenderTexture = createEmptyTexture(device, width, height);
        const destPassRenderTexture = createEmptyTexture(device, width, height);

        const horizontalPassBindGroup = device.createBindGroup({
            layout: horizontalBlurPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: horizontalPassRenderTexture.createView() },
            ],
        });
        const verticalPassBindGroup = device.createBindGroup({
            layout: verticalBlurPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: verticalPassRenderTexture.createView() },
            ],
        });

        const paramsbuffer = createFloatBufferAtCreate(
            'paramsbuffer', device,
            GPUBufferUsage.UNIFORM,
            [blur, blur, width, height]); 

        const encoder = device.createCommandEncoder({
            label: 'render quad encoder',
        });

        {
            const pass = encoder.beginRenderPass({
                label: 'our basic canvas renderPass 1',
                colorAttachments: [
                    {
                        view:  horizontalPassRenderTexture.createView(),
                        clearValue: [0,0,0, 0],
                        loadOp: 'clear',
                        storeOp: 'store',
                        format: presentationFormat, // Use the same format

                    },
                ],
            });
            pass.setPipeline(preBlurPipeline);

            const bindGroup = device.createBindGroup({
                layout: preBlurPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: inputTexture.createView() },
                    { binding: 2, resource: paramsbuffer },
                ],
            });

            pass.setBindGroup(0, bindGroup);
            pass.draw(6);
            pass.end();

        }
        {
            const pass = encoder.beginRenderPass({
                label: 'our basic canvas renderPass 1',
                colorAttachments: [
                    {
                        view:  verticalPassRenderTexture.createView(),
                        clearValue: [0,0,0, 0],
                        loadOp: 'clear',
                        storeOp: 'store',
                        format: presentationFormat, // Use the same format

                    },
                ],
            });
            pass.setPipeline(horizontalBlurPipeline);
            pass.setVertexBuffer(0, vertexBuffer);
            const bg2 = device.createBindGroup({
                layout: horizontalBlurPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: horizontalPassRenderTexture.createView() },
                ],
            });
            pass.setBindGroup(0, bg2);
            pass.draw(6, 1, 0, 0);
            pass.end()

        }

        {
            const pass = encoder.beginRenderPass({
                label: 'our basic canvas renderPass 1',
                colorAttachments: [
                    {
                        view:  destPassRenderTexture.createView(),
                        clearValue: [0,0,0, 0],
                        loadOp: 'clear',
                        storeOp: 'store',
                        format: presentationFormat, // Use the same format

                    },
                ],
            });
            pass.setPipeline(verticalBlurPipeline);
            pass.setVertexBuffer(0, vertexBuffer);
            const bg2 = device.createBindGroup({
                layout: verticalBlurPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: verticalPassRenderTexture.createView() },
                ],
            });
            pass.setBindGroup(0, bg2);
            pass.draw(6, 1, 0, 0);
            pass.end()

        }

        device.queue.submit([encoder.finish()]);

        return {
            outputTexture: destPassRenderTexture, 
            offset: [blur,blur],
        }
    }


    return {
        name: 'BlurFilter',
        runFilter
    }

}

