import shader from './mesh.wgsl?raw';
import textureShader from './mesh-texture.wgsl?raw';
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

    function generateTextureRender(context) {
        const device = context.device;
       
        const defaultTexture = context.texturePainter.defaultTexture;
        const meshTextureShaderProgram = device.createShaderModule({
            code: textureShader,
        });
        const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
        const meshTextureBindGroupLayout = device.createBindGroupLayout({
            label: 'mesh gloabl binding layout',
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 48 },
                },
            ],
        });
        const textureBindGroupLayout = context.texturePainter.textureBindGroupLayout;
        const meshTexturePipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ 
                meshTextureBindGroupLayout,
                textureBindGroupLayout
            ],
        });

        const pipelineDescription = {
            label: 'mesh texture pipeline',
            layout: meshTexturePipelineLayout,
            vertex: {
                module: meshTextureShaderProgram,
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
                module: meshTextureShaderProgram,
                entryPoint: "fs",
                targets: [{ 
                    format: preferredCanvasFormat, 
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

        const renderShapePipeline = device.createRenderPipeline(pipelineDescription);
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        function renderTexture(instance, config, originTexture) {
            const { 
                path,
                _zIndex, 
                _colors,
                _opacity, 
                texture,
            } = config;
            const box = instance._localBoundingbox;
            const points = preparePointsBuffer(path);
            const vertices = triangulate(points);
            const indices = new Array(vertices.length / 2)
                .fill(undefined)
                .map((_, i) => i);

            const indicesbuffer = createUnit16BufferAtCreate(
                'SegmentBuffer', device,
                GPUBufferUsage.INDEX,
                indices);
            const vertexbuffer = createFloatBufferAtCreate(
                'SegmentBuffer', device,
                GPUBufferUsage.VERTEX,
                vertices);
            

            const uniformBuffer = device.createBuffer({
                size: Float32Array.BYTES_PER_ELEMENT * 48,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            }) ;
            const uniformValue = new Float32Array(uniformBuffer.getMappedRange());
            uniformValue[0] = 1;
            uniformValue[1] = texture ? 1: 0;
           
            uniformValue[4] = box.LT[0];
            uniformValue[5] = box.LT[1]; 
            uniformValue[6] = box.RB[0];
            uniformValue[7] = box.RB[1];   

            uniformValue[8] = _colors[0];
            uniformValue[9] = _colors[1];
            uniformValue[10] = _colors[2];
            uniformValue[11] = _colors[3];
            uniformBuffer.unmap();

            // console.log(vertices, indices, box, uniformValue)

            const bindGroup = device.createBindGroup({
                label: 'bindingGroup',
                layout: meshTextureBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                ],
            });

            let textureBindGroup;
            if(texture) {
                if(texture.dirty) {
                    texture.paint(context.texturePainter);
                }
                textureBindGroup = texture.bindGroup;
            } else {
                textureBindGroup = defaultTexture.bindGroup;
            }

           

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                label: 'mesh texture render pass',
                colorAttachments: [
                    {
                        view: originTexture.createView(),
                        clearValue: [0,0,0,0],
                        loadOp: 'clear',
                        storeOp: 'store',
                        format: presentationFormat, 
                    }
                ]
            });
            pass.setPipeline(renderShapePipeline);
            pass.setVertexBuffer(0, vertexbuffer);
            pass.setIndexBuffer(indicesbuffer, 'uint16');
            pass.setBindGroup(0, bindGroup);    
            pass.setBindGroup(1, textureBindGroup);  
            pass.drawIndexed(indices.length, 1);
            // pass.draw(6);
            pass.end();

            device.queue.submit([encoder.finish()]);
        }

        return {
            renderTexture
        }
    }
   
    function generateRender(context) {
        const device = context.device;
        const defaultTexture = context.texturePainter.defaultTexture;
        const shapeProgram = device.createShaderModule({
            code: shader,
        });
        const bindGroupLayout = device.createBindGroupLayout({
            label: 'mesh gloabl binding layout',
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
                    buffer: { type: 'uniform', minBindingSize: 96 },
                },
            ],
        });
        const textureBindGroupLayout = context.texturePainter.textureBindGroupLayout;
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ 
                bindGroupLayout,
                textureBindGroupLayout
            ],
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

        const uniformBufferSize = 96;
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
                texture,
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

            if(texture) {
                if(texture.dirty) {
                    texture.paint(context.texturePainter);
                }
                config.addBindGroup('textureBindGroup', texture.bindGroup)
            } else {
                config.addBindGroup('textureBindGroup', defaultTexture.bindGroup)
            }

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
                    _opacity, 
                    texture,
                } = config.getConfig();
                const box = config.getInstance()._localBoundingbox;
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset, 
                    f32Offset + 12);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + 12, 
                    f32Offset + 24);
                materialValue[0] = _zIndex;
                materialValue[1] = _opacity;
                materialValue[2] = texture ? 1: 0;
                materialValue[4] = box.LT[0];
                materialValue[5] = box.LT[1]; 
                materialValue[6] = box.RB[0];
                materialValue[7] = box.RB[1];   

                materialValue[8] = _colors[0];
                materialValue[9] = _colors[1];
                materialValue[10] = _colors[2];
                materialValue[11] = _colors[3];
                copyMat3(shapeMatrixValue, mat);
            }
            transferBuffer.unmap();
        }


        function render(encoder, passEncoder, maskIndex, configs, cacheContext, renderCondition) {
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
                if(renderCondition && !renderCondition(instance)){
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
                passEncoder.setBindGroup(1, config.getBindGroup('textureBindGroup'));  
                passEncoder.drawIndexed(config.getPainterConfig('IndicesLength'), 1);
            }
        }
        function afterRender(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                cacheTransferBuffer(transferBuffer);
            });
        }

        function renderMaskBegin(encoder, passEncoder, configs, configIndex, cacheContext) {
            const bindGroup = bindGroups[configIndex];
            const config = configs[configIndex];
            passEncoder.setPipeline(MaskBeginPipline);
            passEncoder.setVertexBuffer(0, config.getBuffer('VertexBuffer'));
            passEncoder.setIndexBuffer(config.getBuffer('IndicesBuffer'), 'uint16');
            passEncoder.setBindGroup(0, bindGroup); 
            passEncoder.setBindGroup(1, config.getBindGroup('textureBindGroup'));     
            passEncoder.drawIndexed(config.getPainterConfig('IndicesLength'), 1);
        }

         function renderMaskEnd(encoder, passEncoder, configs, configIndex, cacheContext) {
            const bindGroup = bindGroups[configIndex];
            const config = configs[configIndex];
            passEncoder.setPipeline(MaskEndPipline);
            passEncoder.setVertexBuffer(0, config.getBuffer('VertexBuffer'));
            passEncoder.setIndexBuffer(config.getBuffer('IndicesBuffer'), 'uint16');
            passEncoder.setBindGroup(0, bindGroup);   
            passEncoder.setBindGroup(1, config.getBindGroup('textureBindGroup'));   
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
        generateTextureRender,
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
    if(!incommingpoints.closePath) {
        return [];
    }
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
    points.push(points[0], points[1]);
    return points;
}