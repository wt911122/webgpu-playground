import gridShader from './grid.wgsl?raw';
import { createBufferWithData } from '../../utils/buffer';

function GridPainter() { 
    const VERTEX_ARRAY = new Float32Array([
        -1, -1, 1, -1, 1, 1, -1, 1
    ]);
    const INDICES_ARRAY = new Uint16Array([
        0, 1, 2, 0, 2, 3
    ]);

    function generateRender(context) {
        const device = context.device;
        const program = device.createShaderModule({
            code: gridShader,
        });

        const vertexBuffer = createBufferWithData(device, VERTEX_ARRAY, GPUBufferUsage.VERTEX);
        const indicesBuffer = createBufferWithData(device, INDICES_ARRAY, GPUBufferUsage.INDEX);
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 160 },
                },
                { 
                    binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 4 },
                },
            ],
        });
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout ],
        });
        const renderPipeline = device.createRenderPipeline({
            label: 'circle pipeline',
            layout: pipelineLayout,
            vertex: {
                module: program,
                entryPoint: "vs",
                buffers: [
                    {
                        arrayStride: 4 * 2,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },
                        ],
                        stepMode: "vertex"
                    },
                ],
            },
            fragment: {
                module: program,
                entryPoint: "fs",
                targets: [{ 
                    format: navigator.gpu.getPreferredCanvasFormat(), 
                    blend: {
                        color: {
                            operation: 'add',
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha'
                        },
                        alpha: {
                            operation: 'add',
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha'
                        }
                    }
                }],

            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });
        

        const bindGroup =  device.createBindGroup({
            label: 'bindingGroup',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: context.worldUniformBuffer } },
                { binding: 1, resource: { buffer: context.shapeUniformBuffer } },
            ],
        });

        function beforeRender() {}

        function render(encoder, passEncoder, configs, cacheContext) {
            const { uniformValues, transferBuffer } = cacheContext;
            passEncoder.setPipeline(renderPipeline);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indicesBuffer, "uint16");
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.drawIndexed(6, 1)
        }

        function afterRender() {}

        function onPainterCreate(painter) {
            painter.configs = [{}]
        }

        return {
            beforeRender,
            render, 
            afterRender,
            onPainterCreate,
        };
    }

    return {
        name: 'GridPainter',
        generateRender,
        // Ctor: []
    }
}
export default GridPainter;