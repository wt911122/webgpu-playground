import shader from './mesh.wgsl?raw';
import earcut, { flatten } from 'earcut';
import { triangulate } from './tessy'
import { paddingMat3, copyMat3 } from '../../utils/transform';

import { 
    GENERAL_DEPTH_STENCIL_CONFIG,
    MASK_BEGIN_DEPTH_STENCIL_CONFIG,
    MASK_END_DEPTH_STENCIL_CONFIG,
} from '../../utils/mask-depthStencil-config';
import { prepareUniform, createFloatBufferAtCreate, createUnit16BufferAtCreate } from '../../utils/shape-uniform';

function MeshPainter() {
    const MAX_OBJECTS = 30000;
   
    function generateRender(context) {
        const device = context.device;
        const shapeProgram = device.createShaderModule({
            code: shader,
        });
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
                { 
                    binding: 2, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 80 },
                },
            ],
        });
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout ],
        });

        const pipelineDescription = {
            label: 'mesh shape pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shapeProgram,
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
                module: shapeProgram,
                entryPoint: "fs",
                targets: [{ 
                    format: navigator.gpu.getPreferredCanvasFormat(), 
                    blend: {
                        color: {
                            operation: 'add',
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha'
                        },
                        alpha: {
                            operation: 'add',
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha'
                        }
                    }
                }],

            },
        }
        const renderShapePipeline = device.createRenderPipeline({
            ...pipelineDescription,
            depthStencil: GENERAL_DEPTH_STENCIL_CONFIG
        });
        const MaskBeginPipline = device.createRenderPipeline({
            ...pipelineDescription,
            depthStencil: MASK_BEGIN_DEPTH_STENCIL_CONFIG
        });
        const MaskEndPipline = device.createRenderPipeline({
            ...pipelineDescription,
            depthStencil: MASK_END_DEPTH_STENCIL_CONFIG
        });


        const uniformBufferSize = 80;
        const {
            uniformBufferSpace,
            bindGroups,
            prepareRender,
            cacheTransferBuffer
        } = prepareUniform(device, {
            MAX_OBJECTS,
            uniformBufferSize,
            bindGroupLayout,
            context,
            label: 'mesh'
        });

        function collecInstanceConfig(instance, config) {
            if(!config.enable) {
                return;
            }
            const { 
                path,
            } = config.getConfig();
            const points = preparePointsBuffer(path);
            const vertices = triangulate(points);
            const indices = new Array(vertices.length / 2)
                .fill(undefined)
                .map((_, i) => i);

            config.setPainterConfig('IndicesLength', indices.length)
            const indicebuffer = config.getBuffer('IndicesBuffer');
            if(indicebuffer) {
                indicebuffer.destroy();
            } 
            config.addBuffer('IndicesBuffer', createUnit16BufferAtCreate(
                'SegmentBuffer', device,
                GPUBufferUsage.INDEX,
                indices))
            
            const pointsbuffer = config.getBuffer('VertexBuffer');
            if(pointsbuffer) {
                pointsbuffer.destroy();
            }
            config.addBuffer('VertexBuffer', createFloatBufferAtCreate(
                'SegmentBuffer', device,
                GPUBufferUsage.VERTEX,
                vertices))
        }

        function beforeRender(encoder, configs, cacheContext) {
            const numObjects = configs.length;
            const { uniformValues, transferBuffer } = prepareRender(encoder, numObjects)
            
            cacheContext.transferBuffer = transferBuffer;
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const {
                    _zIndex, 
                    mat,
                    _colors, 
                } = config.getConfig();
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset, 
                    f32Offset + 8);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + 8, 
                    f32Offset + 20);
                materialValue[0] = _zIndex;
                materialValue[4] = _colors[0];
                materialValue[5] = _colors[1];
                materialValue[6] = _colors[2];
                materialValue[7] = _colors[3];
                copyMat3(shapeMatrixValue, mat);
            }
            transferBuffer.unmap();
        }


        function render(encoder, passEncoder, maskIndex, configs, cacheContext) {
            let _f = false;
            const numObjects = configs.length;
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const instance = config.getInstance();
                if(instance._maskIndex !== maskIndex) {
                    continue;
                }
                if(!_f) {
                    passEncoder.setPipeline(renderShapePipeline);
                    _f = true;
                }
                const bindGroup = bindGroups[i];
                passEncoder.setVertexBuffer(0, config.getBuffer('VertexBuffer'));
                passEncoder.setIndexBuffer(config.getBuffer('IndicesBuffer'), 'uint16');
                passEncoder.setBindGroup(0, bindGroup);    
                passEncoder.drawIndexed(config.getPainterConfig('IndicesLength'), 1);
            }
        }
        function afterRender(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                cacheTransferBuffer(transferBuffer);
            });
        }

        function renderMaskBegin(encoder, passEncoder, configs, cacheContext) {
            const { configIndex } = cacheContext;
            const bindGroup = bindGroups[configIndex];
            const config = configs[configIndex];
            passEncoder.setPipeline(MaskBeginPipline);
            passEncoder.setVertexBuffer(0, config.getBuffer('VertexBuffer'));
            passEncoder.setIndexBuffer(config.getBuffer('IndicesBuffer'), 'uint16');
            passEncoder.setBindGroup(0, bindGroup);    
            passEncoder.drawIndexed(config.getPainterConfig('IndicesLength'), 1);
        }

         function renderMaskEnd(encoder, passEncoder, configs, cacheContext) {
            const { configIndex } = cacheContext;
            const bindGroup = bindGroups[configIndex];
            const config = configs[configIndex];
            passEncoder.setPipeline(MaskEndPipline);
            passEncoder.setVertexBuffer(0, config.getBuffer('VertexBuffer'));
            passEncoder.setIndexBuffer(config.getBuffer('IndicesBuffer'), 'uint16');
            passEncoder.setBindGroup(0, bindGroup);    
            passEncoder.drawIndexed(config.getPainterConfig('IndicesLength'), 1);
        }

        return {
            collecInstanceConfig,
            beforeRender,
            render, 
            afterRender,
            renderMaskBegin,
            renderMaskEnd
        };
    }
    return {
        name: 'MeshPainter',
        generateRender,
    }
}

export default MeshPainter;


function preparePointsBuffer(
    points, 
) {
    if(Array.isArray(points[0])) {
        return points.map(p => _preparePointsBuffer(p));
    } else {
        return [
            _preparePointsBuffer(points)
        ]
    }

}

function _preparePointsBuffer(
    incommingpoints, 
) {
    let lastX;
    let lastY;
    const points = [];
    const inpoints = incommingpoints.slice();
    while(inpoints.length) {
        const x = inpoints.shift();
        const y = inpoints.shift();
        if(Math.abs(lastX - x) < 0.00001
            && Math.abs(lastY - y) < 0.00001 ) {
            const l = points.length-1;
            points[l][0] = x;
            points[l][1] = y;
        } else {
            points.push([x, y]);
        }
        lastX = x;
        lastY = y;
    }
    return points;
}