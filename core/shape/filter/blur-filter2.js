
import preBlurShader from './pre-blur-texture.wgsl?raw';
import blurWGSL from './blur.wgsl?raw'; 
import { createFloatBufferAtCreate } from '../../utils/shape-uniform';

const tileDim = 128;
const batch = [4, 4];
const settings = {
    filterSize: 15,
    iterations: 2,
};
// const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
const preferredCanvasFormat = 'rgba8unorm';
function createEmptyTexture(device, width, height) {
    const texture = device.createTexture({
        size: [width, height],
        format: preferredCanvasFormat,
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });
    return texture;
}

export function prepareFilter(device) {
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });
    const preBlurModule = device.createShaderModule({
        code: preBlurShader,
    })
    const preBlurPipeline = device.createRenderPipeline({
        label: 'partPipeline textured quad pipeline',
        layout: 'auto',
        vertex: {
            module: preBlurModule,
        },
        fragment: {
            module: preBlurModule,
            targets: [{ format: preferredCanvasFormat }],
        },
    });

    const blurPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: blurWGSL,
            }),
        },
    });

    // A buffer with 0 in it. Binding this buffer is used to set `flip` to 0
    const buffer0 = (() => {
        const buffer = device.createBuffer({
            size: 4,
            mappedAtCreation: true,
            usage: GPUBufferUsage.UNIFORM,
        });
        new Uint32Array(buffer.getMappedRange())[0] = 0;
        buffer.unmap();
        return buffer;
    })();

    // A buffer with 1 in it. Binding this buffer is used to set `flip` to 1
    const buffer1 = (() => {
        const buffer = device.createBuffer({
            size: 4,
            mappedAtCreation: true,
            usage: GPUBufferUsage.UNIFORM,
        });
        new Uint32Array(buffer.getMappedRange())[0] = 1;
        buffer.unmap();
        return buffer;
    })();

    function runFilter(inputTexture, options = {}, originWidth, originHeight) {
        options = Object.assign({}, settings, options)
        const blur = options.blur;
        const filterSize = Math.min(tileDim-1, Math.floor(blur/2));
        const iterations = options.iterations;
        const blurWidth = originWidth + blur*2;
        const blurHeight = originHeight + blur*2;

        const expandTexture = createEmptyTexture(device, blurWidth, blurHeight);

        const encoder = device.createCommandEncoder({
            label: 'render quad encoder',
        });

        {
            const paramsbuffer = createFloatBufferAtCreate(
                'paramsbuffer', device,
                GPUBufferUsage.UNIFORM,
                [blur, blur, blurWidth, blurHeight]); 
            const pass = encoder.beginRenderPass({
                label: 'our basic canvas renderPass 1',
                colorAttachments: [
                    {
                        view:  expandTexture.createView(),
                        clearValue: [0,0,0, 0],
                        loadOp: 'clear',
                        storeOp: 'store',
                        format: preferredCanvasFormat, // Use the same format

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
        device.queue.submit([encoder.finish()]);

        const textures = [0, 1].map(() => {
            return device.createTexture({
                size: {
                    width: blurWidth,
                    height: blurHeight,
                },
                format: preferredCanvasFormat,
                usage: GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.STORAGE_BINDING |
                    GPUTextureUsage.TEXTURE_BINDING,
            });
        });
        const blurParamsBuffer = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        const blockDim = tileDim - filterSize;
        device.queue.writeBuffer(
            blurParamsBuffer,
            0,
            new Uint32Array([filterSize + 1, blockDim])
        );

        const computeConstants = device.createBindGroup({
            layout: blurPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: sampler,
                },
                {
                    binding: 1,
                    resource: {
                        buffer: blurParamsBuffer,
                    },
                },
            ],
        });

        const computeBindGroup0 = device.createBindGroup({
            layout: blurPipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 1,
                    resource: expandTexture.createView(),
                },
                {
                    binding: 2,
                    resource: textures[0].createView(),
                },
                {
                    binding: 3,
                    resource: {
                        buffer: buffer0,
                    },
                },
            ],
        });

        const computeBindGroup1 = device.createBindGroup({
            layout: blurPipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 1,
                    resource: textures[0].createView(),
                },
                {
                    binding: 2,
                    resource: textures[1].createView(),
                },
                {
                    binding: 3,
                    resource: {
                        buffer: buffer1,
                    },
                },
            ],
        });

        const computeBindGroup2 = device.createBindGroup({
            layout: blurPipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 1,
                    resource: textures[1].createView(),
                },
                {
                    binding: 2,
                    resource: textures[0].createView(),
                },
                {
                    binding: 3,
                    resource: {
                        buffer: buffer0,
                    },
                },
            ],
        });

        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(blurPipeline);
        computePass.setBindGroup(0, computeConstants);

        computePass.setBindGroup(1, computeBindGroup0);
        computePass.dispatchWorkgroups(
            Math.ceil(blurWidth / blockDim),
            Math.ceil(blurHeight / batch[1])
        );

        computePass.setBindGroup(1, computeBindGroup1);
        computePass.dispatchWorkgroups(
            Math.ceil(blurHeight / blockDim),
            Math.ceil(blurWidth / batch[1])
        );

        for (let i = 0; i < iterations - 1; ++i) {
            computePass.setBindGroup(1, computeBindGroup2);
            computePass.dispatchWorkgroups(
                Math.ceil(blurWidth / blockDim),
                Math.ceil(blurHeight / batch[1])
            );

            computePass.setBindGroup(1, computeBindGroup1);
            computePass.dispatchWorkgroups(
                Math.ceil(blurHeight / blockDim),
                Math.ceil(blurWidth / batch[1])
            );
        }

        computePass.end();
        device.queue.submit([commandEncoder.finish()]);

        return {
            outputTexture: textures[1], 
            offset: [blur,blur],
        }
    }

    return {
        name: 'BlurFilter',
        runFilter
    }
   
}