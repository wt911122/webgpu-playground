import shader from './shader.wgsl?raw';
import { createBufferWithData } from '../../utils/buffer';
import { 
    GENERAL_DEPTH_STENCIL_CONFIG,
} from '../../utils/mask-depthStencil-config';
import { prepareUniform, createFloatBufferAtCreate, createUnit16BufferAtCreate } from '../../utils/shape-uniform';
import { paddingMat3, copyMat3 } from '../../utils/transform';
import { prepareFilter as prepareBlurFilter } from './blur-filter2'; 
import InstanceConfig from '../../config'; 

class FilterConfig extends InstanceConfig {
    constructor(instance, configMeta = {}) {
        super(instance, configMeta);
    }
    updateConfig() {
        this._checkState();
        if(this.enable) {
            const instance = this.getInstance();
            Object.assign(this._config,  {
                _zIndex: instance._zIndex,
                _opacity: instance._opacity,
                mat: paddingMat3(instance._currentMat)
            });
        }
    }
}

function FilterPainter() {
    const MAX_OBJECTS = 10000;
    const VERTEX_ARRAY = new Float32Array([
        // top left 
        0.0, 1.0, 0.0, 0.0,
        // top right
        1.0, 1.0, 1.0, 0.0,
        // bottom left 
        0.0, 0.0, 0.0, 1.0,

        // bottom left
        0.0, 0.0, 0.0, 1.0,
        // top right
        1.0, 1.0, 1.0, 0.0,
        // bottom right
        1.0, 0.0, 1.0, 1.0
    ]);
    const Filters = new Map();

    function generateRender(context) {
        const device = context.device;
        const defaultTexture = context.texturePainter.defaultTexture;
        const shapeProgram = device.createShaderModule({
            code: shader,
        });
        const objBindSize = 80;
        const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
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
                    buffer: { type: 'uniform', minBindingSize: objBindSize },
                },
            ],
        });
        const textureBindGroupLayout = device.createBindGroupLayout({
            label: 'texture bindgroup layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    texture: {
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                }
            ],
        });
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ 
                bindGroupLayout,
                textureBindGroupLayout
            ],
        });

        const renderShapePipeline = device.createRenderPipeline({
            label: 'texture shape pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shapeProgram,
                entryPoint: "vs",
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
            depthStencil: GENERAL_DEPTH_STENCIL_CONFIG
        });
        const vertexBuffer = createBufferWithData(device, VERTEX_ARRAY, GPUBufferUsage.VERTEX);
        

        const MATIRIAL_OFFSET = 0;
        const TRAN_OFFSET = 8;
        const uniformBufferSize = objBindSize;
        const {
            uniformBufferSpace,
            bindGroups,
            prepareRender,
            cacheTransferBuffer,
            transferData
        } = prepareUniform(device, {
            MAX_OBJECTS,
            uniformBufferSize,
            bindGroupLayout,
            context,
            label: 'texture'
        });
        
        const sampler = device.createSampler({
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
        });

        const blurFilter = prepareBlurFilter(device);
        Filters.set(blurFilter.name, blurFilter)
        
        function collecInstanceConfig(instance, config, jcanvas, filters, modifyConfig) {
            if(!config.enable) {
                return;
            }

            const originTexture = device.createTexture({
                format: preferredCanvasFormat,
                mipLevelCount: 1, // options.mips ? numMipLevels(source.width, source.height) : 1,
                size: [instance.width, instance.height],
                usage: GPUTextureUsage.TEXTURE_BINDING |
                        GPUTextureUsage.COPY_DST |
                        GPUTextureUsage.RENDER_ATTACHMENT,
            });

            /*const canvas = document.createElement('canvas');
            canvas.width = instance.width;
            canvas.height = instance.height;
            const context = canvas.getContext('2d');
            context.fillStyle = 'rgb(255, 255, 0)';
            context.fillRect(0, 0, instance.width, instance.height);

            document.body.append(canvas)

            device.queue.copyExternalImageToTexture(
                { source: canvas },
                { texture: originTexture },
                [canvas.width, canvas.height],
            ); */

            jcanvas._painterRegistry.iterateOnInstance(instance, (painter) => {
                const meta = painter.getConfigFnMeta(instance);
                if(meta && painter._renderTexture) {
                    const config = instance[meta.fnName]();
                    if(modifyConfig) {
                        modifyConfig(instance, config, painter);
                    }
                    painter._renderTexture(instance, config, originTexture);
                }
            });

            let lastTexture = originTexture;
            let expand = [0,0];
            // applyFilters start
            (filters || instance.filters).forEach(({ filter, options }) => {
                const filterInstance = Filters.get(filter);
                if(filterInstance) {
                    const {
                        outputTexture, 
                        offset
                    } = filterInstance.runFilter(lastTexture, options, instance.width, instance.height)
                    lastTexture = outputTexture;
                    expand[0] = offset[0];
                    expand[1] = offset[1];
                }
            });
            // applyFilters end
            // console.log(expand)
            const bindGroup = device.createBindGroup({
                layout: textureBindGroupLayout,
                entries: [
                    { binding: 0, resource: lastTexture.createView() },
                    { binding: 1, resource: sampler }
                ],
            });
            config.addBindGroup('textureBindGroup', bindGroup);
            config.setPainterConfig('bounding', [instance.width, instance.height])
            config.setPainterConfig('expand', expand)

        }

        function prepareUniformBuffer(encoder, configs, cacheContext) {
            const numObjects = configs.length;
            // console.log(numObjects);
            const { uniformValues, transferBuffer } = prepareRender(encoder, numObjects)
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const {
                    _zIndex, mat, _opacity
                } = config.getConfig();
                const bounding = config.getPainterConfig('bounding');
                const expand = config.getPainterConfig('expand')
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset + MATIRIAL_OFFSET, 
                    f32Offset + TRAN_OFFSET);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + TRAN_OFFSET, 
                    f32Offset + TRAN_OFFSET + 12);
                materialValue[0] = _zIndex;
                materialValue[1] = _opacity;
                materialValue[2] = bounding[0];
                materialValue[3] = bounding[1];
                materialValue[4] = expand[0];
                materialValue[5] = expand[1];
                
                copyMat3(shapeMatrixValue, mat);

            }
            transferBuffer.unmap();
            transferData(encoder, transferBuffer, numObjects);
            cacheContext.transferBuffer = transferBuffer;
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
                    passEncoder.setVertexBuffer(0, vertexBuffer);
                    _f = true;
                }
                const bindGroup = bindGroups[i];
                passEncoder.setBindGroup(0, bindGroup);  
                passEncoder.setBindGroup(1, config.getBindGroup('textureBindGroup'));
                passEncoder.draw(6);
            }
        }

        function usePipeline(passEncoder) {
            passEncoder.setPipeline(renderShapePipeline);
            passEncoder.setVertexBuffer(0, vertexBuffer);
        }

        function renderInstance(passEncoder, configs, i) {
            const config = configs[i];
            if(!config.enable) {
                return;
            }
            const bindGroup = bindGroups[i];
            passEncoder.setBindGroup(0, bindGroup);  
            passEncoder.setBindGroup(1, config.getBindGroup('textureBindGroup'));
            passEncoder.draw(6);
        }

        function prepareTransferBuffer(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                cacheTransferBuffer(transferBuffer);
            });
        } 

        return {
            collecInstanceConfig,
            prepareUniformBuffer,
            render, 
            prepareTransferBuffer,
            usePipeline,
            renderInstance
        };
    }

    return {
        name: 'FilterPainter',
        generateRender,
        configCor: FilterConfig,
    }
}

export default FilterPainter;