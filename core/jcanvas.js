import { vec2, mat3 } from 'gl-matrix';

import Group from './layer/group';
import Stage from './layer/stage';
import Layer, { traverse } from './layer/layer';
import { Camera } from './utils/camera';
import { createCanvas } from './utils/canvas';
import { Box } from './utils/box';
import IndexRBush from './utils/indexRBush.js';
import { paddingMat3 } from './utils/transform';
import PainterRegistry from './painter-registry';
import { JEvent } from './event/event-target'

import SDFPainter from './shape/sdf';
import GridPainter from './shape/grid';
import PolylinePainter from './shape/polyline/painter-new.js';
import MeshPainter from './shape/mesh/mesh-painter2';
import MSDFTextPainter from './shape/msdftext/msdf-painter2';
import SmoothPolyPainter from './shape/smooth-polyline/smooth-poly2.js';
import SDFRectPainter from './shape/sdf/sdf-rect-painter2';
import FilterPainter from './shape/filter/filter-painter';
import DropShadowPainter from './shape/drop-shadow/drop-shadow-painter.js'

import GroupCtor from './layer/group';
import EllipseCtor from './instance/ellipse';
import RectangleCtor from './instance/rectangle';
import PolyLineCtor from './instance/polyline';
import PathCtor from './instance/path';
import TextCtor from './instance/Text';
import MSDFTextCtor from './instance/MSDFText';

import InfraRegistry from './infra/infra-registry';
import EventResolver from './event/event-resolver';
import SelectBox from './infra/select-box';

import FontRegistry from './font/font-registry';

import { TexturePainter } from './texture/painter';
import { BlurFilterPainter } from './texture/filter/blur-filter.js'

class JCanvas {
    _stage = new Stage();
    _viewport = new Box();
    _lockBox = new Box();
    _indexRBush = new IndexRBush();

    _painterRegistry = new PainterRegistry();
    _shapeRegistry = new Map();
    _infraRegistry = new InfraRegistry();
    _MSDFfontRegistry = new FontRegistry();

    _mousevec = vec2.create();

    get stage() {
        return this._stage;
    }

    get indexRBush() {
        return this._indexRBush;
    }

    get canvas() {
        return this.context?.canvas;
    }

    get currentMouseLocation() {
        return this._mousevec;
    }

    constructor() {
        this._stage.jcanvas = this;
        this.usePainter(GridPainter);

        this.usePainter(SDFRectPainter);
        this.usePainter(MeshPainter);
        this.usePainter(SmoothPolyPainter);
        this.usePainter(MSDFTextPainter);
        this.usePainter(FilterPainter);
        this.usePainter(DropShadowPainter);
       

       
        this.useShape('Group', GroupCtor);
        this.useShape('Ellipse', EllipseCtor);
        this.useShape('Rectangle', RectangleCtor);
        this.useShape('Path', PathCtor);
        this.useShape('PolyLine', PolyLineCtor);
        // this.useShape('Text', TextCtor);
        this.useShape('MSDFText', MSDFTextCtor);

        this.useInfra(EventResolver);
        this.useInfra(SelectBox);
    }

    registMSDFont(fontFamily, url) {
        this._MSDFfontRegistry.regist(fontFamily, url);
    }
    async loadMSDFFont(device) {
        await this._MSDFfontRegistry.load(device)
    }

    useShape(name, ctor) {
        const pipeline = ctor.attachPainter();
        const total = pipeline.length;
        pipeline.forEach((painterDesc, idx) => {
            const { 
                ctor, painter, configGetter, condition
            } = painterDesc;

            this._painterRegistry.usePainter(ctor, painter, configGetter, condition, idx, total)
        });
        const creator = (...argus) => {
            const q = new ctor(...argus)
            q.jcanvas = this;
            return q;
        };
        this._shapeRegistry.set(name, creator)
        return creator;
    }

    getShapeCtor(name) {
        return this._shapeRegistry.get(name);
    }

    usePainter(painter) {
        const shapePainter = this._painterRegistry.regist(painter());
        return shapePainter;
    }

    useInfra(infra) {
        this._infraRegistry.regist(infra())
    }

    async $mount(dom) {
        const { 
            canvas, 
            ctx, 
            DPR, 
            width: c_width, 
            height: c_height, 
            raw_width,
            raw_height,
            left, top 
        } = createCanvas(dom);
        this._bindMeshAndRender = this.meshAndRender.bind(this);
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        // device.addEventListener('uncapturederror', event => {
        //     console.log(event.error.message);
        // });
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({
            device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        })
        await this.loadMSDFFont(device);
        const texturePainter = TexturePainter(device);
        const camera = Camera();
        camera.projection(c_width, c_height);
        camera.update();
        const worldUniformBuffer = _createWorldUniformBuffer(device);
        const shapeUniformBuffer = _createShapeUniformBuffer(device);

        this.context = {
            canvas,
            ctx,
            camera,
            device,
            width: c_width,
            height: c_height,
            viewport: this._viewport,
            
            worldUniformBuffer,
            shapeUniformBuffer,
            jcanvas: this,
            texturePainter,
        }

        this.updateViewport();
        this.cacheConfigs();
        this.initPipeline();
        this.render = createScheduleRender(this._render.bind(this));
        this._infraRegistry.setup(this.context);
    }

    initPipeline() {
        this._painterRegistry.iterate((painter, ctor) => {
            painter.init(this.context)
        })
    }

    cacheConfigs() {
        const { canvas, ctx, device } = this.context;
        this._depthTexture = _createDepthTexture(canvas, device);
        // this._renderPassDescriptor = _createRenderPassDescriptor(ctx, depthTexture);
    }

    normalizeVec(x, y) {
        const { width, height } = this.context;
        return vec2.fromValues((x / width) * 2 - 1, (1 - y / height) * 2 - 1)
    }

    viewport2Canvas(x, y, outvec) {
        const viewProjectionMatrixInv = this.context.camera.getViewProjectMatrixInv();
        vec2.transformMat3(
            outvec,
            this.normalizeVec(x, y),
            viewProjectionMatrixInv);
    }

    updateViewport() {
        const { width, height } = this.context;
        const _viewport = this._viewport;
        this.viewport2Canvas(0, 0, _viewport.LT);
        this.viewport2Canvas(width, height, _viewport.RB);
        vec2.set(_viewport.LB, _viewport.LT[0], _viewport.RB[1]);
        vec2.set(_viewport.RT, _viewport.RB[0], _viewport.LT[1]);
        _viewport.boundingRbush;
    }

    updateWorldUniform() {
        const { camera, worldUniformBuffer, device } = this.context;
        const buffer = new Float32Array([
            ...paddingMat3(camera.getProjectMatrix()),
            ...paddingMat3(camera.getViewMatrix()),
            ...paddingMat3(camera.getViewProjectMatrixInv()),
            camera.getZoom(),
            camera.getAspectRatio(),
        ]);
        device.queue.writeBuffer(worldUniformBuffer, 0, buffer);
    }

    // calculateDownBoundingbox() {
    //     this._stage.calculateDownBoundingbox(mat3.create())
    // }

    lockTarget(offsetX, offsetY, ignoreTarget) {
        // console.time('lockTarget')
        const _lockBox = this._lockBox;
        const viewProjectionMatrixInv = this.context.camera.getViewProjectMatrixInv();
        const mouseVec = this._mousevec;
        vec2.transformMat3(
            _lockBox.LT,
            this.normalizeVec(offsetX-1, offsetY-1),
            viewProjectionMatrixInv);
        vec2.transformMat3(
            _lockBox.RB,
            this.normalizeVec(offsetX+1, offsetY+1),
            viewProjectionMatrixInv);
        vec2.transformMat3(
            mouseVec,
            this.normalizeVec(offsetX, offsetY),
            viewProjectionMatrixInv);
        const shapes = this.indexRBush.inBound([..._lockBox.LT, ..._lockBox.RB]);
        if(shapes.length) {
            shapes.sort((a, b) => b._zIndex - a._zIndex);
            let shape;
            for(let i=0;i<shapes.length;i++) {
                shape = shapes[i];
                if(!shape.visible) {
                    continue;
                }
                if(ignoreTarget && ignoreTarget.includes(shape)) {
                    continue;
                }
                const r = shape.checkHit(mouseVec);
                if(r) {
                    return shape;
                }
            }
            // console.timeEnd('lockTarget')
        }
        // console.timeEnd('lockTarget')
        return null;
    }

    pan(deltaX, deltaY) {
        this.context.camera.pan(deltaX, deltaY);
        this.updateViewport();
        // this.dispatchEvent(new CustomEvent('zoompan'));
        this.render();
    }
    
    zoom(offsetX, offsetY, deltaX, deltaY) {
        const position = this.normalizeVec(offsetX, offsetY)
        const camera = this.context.camera;
        const [preZoomX, preZoomY] = vec2.transformMat3(
            vec2.create(),
            position,
            camera.getViewProjectMatrixInv(),
        );

        const newZoom = camera.getZoom() * Math.pow(2, deltaY * -0.01);
        camera.zoom(newZoom);
        
        const [postZoomX, postZoomY] = vec2.transformMat3(
            vec2.create(),
            position,
            camera.getViewProjectMatrixInv(),
        );

        camera.pan(preZoomX - postZoomX, preZoomY - postZoomY, true);
        this.updateViewport();
        const event = new JEvent('zoom', { zoom: newZoom });
        event.targetPhase();
        this.stage.dispatchEvent(event);
        this.render();
    }

    meshDirtyInstance(instance) {
        if(instance._materialdirty || instance._geodirty) {
            if(instance.useTexture) {
                const painter = this._painterRegistry.getPainter('FilterPainter');
                const dirty = painter.collectConfigHandler(instance, this);
                if(dirty) {
                    painter._dirty = true
                }
            } else {
                this._painterRegistry.iterate(painter => {
                    const dirty = painter.collectConfig(instance, this);
                    if(dirty) {
                        painter._dirty = true;
                    }
                })
            }
           
            instance._materialdirty = false;
            instance._geodirty = false;
        }
    }

    mesh() {
        const shapeRegistry = this._painterRegistry;
        let zindex = 20;
        // console.time('mesh')
        
        let maskIndex = 0;
        let maskStack = [];
        const delayedMesh = [];
        let maxLayer = 0;
        // let maskLayer = 0;
        this._stage.traverse(
            // callback
            (instance) => {
                if(instance.renderable) {
                    instance._zIndex = zindex++;
                    this.meshDirtyInstance(instance);
                }
                if(instance.mask) {
                    maskIndex++;
                    maskStack.push(maskIndex);
                    if(instance._materialdirty || instance._geodirty) {
                        delayedMesh.push(instance.mask)
                    }
                }
                instance._maskIndex = maskStack[maskStack.length-1];
                instance._maskLayer = maskStack.length;
                maxLayer = Math.max(instance._maskLayer, maxLayer)
            }, 
            // callbackleave
            (instance) => {
                if(instance.mask) {
                    maskStack.pop();
                }
            }
        );
        // console.log(maxLayer, maskIndex)
        delayedMesh.forEach(instance => {
            this.meshDirtyInstance(instance);
        });
        this._painterRegistry.iterate((painter) => {
            if(painter._dirty) {
                painter.afterCollectConfig();
            }
        })
        
        this._zIndexCounter = zindex + 20;
        this.context.device.queue.writeBuffer(
            this.context.shapeUniformBuffer, 
            0, 
            new Float32Array([this._zIndexCounter]));
        // console.timeEnd('mesh')
    }

    meshAndRender() {
        this.mesh();
        this.render();
    }

    _render() {
        this.updateWorldUniform();
        // const shapes = this._culling.inBound(this.context.viewport.bounding)
        const device = this.context.device;
        const encoder = device.createCommandEncoder();
        const _painterRegistry = this._painterRegistry;
        _painterRegistry.iterate((painter) => {
            painter.beforeRender(encoder)
        })
        /* const passEncoder = encoder.beginRenderPass(_createRenderPassDescriptor(this.context.ctx, this._depthTexture));
        this._painterRegistry.iterate((painter) => {
            painter.render(encoder, passEncoder)
        })
        passEncoder.end();
        */
        const passEncoder = encoder.beginRenderPass(_createRenderPassDescriptor(this.context.ctx, this._depthTexture));
        // let maskLayer = -1;

        passEncoder.setStencilReference(0);
        
        this._stage.traverseOnlyLayer(
            (i) => {
                // if(i._maskLayer > maskLayer) {
                    // render mask 
                    // setStencilReference
                    const { _maskIndex, _maskLayer, mask } = i;
                    if(mask) {
                        // console.log(`renderMaskBegin layer:${_maskLayer}, maskIndex:${_maskIndex}`);
                        _painterRegistry.iterateOnInstance(mask, (painter) => {
                            painter.renderMaskBegin(mask, encoder, passEncoder);
                        });
                        passEncoder.setStencilReference(_maskLayer);
                        // console.log(`render layer:${_maskLayer}, maskIndex:${_maskIndex}`);
                       
                        // console.log('setStencilReference', _maskLayer)
                    }
                    // console.log(`render layer:${_maskLayer}, maskIndex:${_maskIndex}`);
                   
                    
                // }
            }, (i) => {
                // render mask end  
                // setStencilReference
                // const prevLayer = i._belongs._maskLayer;
                // if(i._maskLayer > prevLayer) {
                const { _maskIndex, _maskLayer, mask } = i;
                if(mask) {
                    // console.log('draw mask: ', _maskLayer)
                     _painterRegistry.iterateGeneral((painter) => {
                        painter.render(encoder, passEncoder, _maskIndex)
                    })
                    // console.log(`renderMaskEnd layer:${_maskLayer}, maskIndex:${_maskIndex}`);
                    _painterRegistry.iterateOnInstance(mask, (painter) => {
                        painter.renderMaskEnd(mask, encoder, passEncoder);
                    });
                    passEncoder.setStencilReference(_maskLayer-1);
                    // console.log('setStencilReference', _maskLayer-1)
                }

            })
        //  console.log('draw mask: ', undefined)
        _painterRegistry.iterateStatic((painter) => {
            painter.render(encoder, passEncoder)
        })

        _painterRegistry.iterateGeneral((painter) => {
            painter.render(encoder, passEncoder)
        })
        passEncoder.end();

        device.queue.submit([encoder.finish()]);
        _painterRegistry.iterate((painter) => {
            painter.afterRender()
        })
    }

    doCollection(instance, layerTransformer, renderCounter) {
        const painter = this._painterRegistry.get(instance.constructor);
        if(!painter) {
            throw `no painter for ${instance.constructor}`
        }

        painter.collect(instance, layerTransformer, renderCounter)
    }

    clear() {
        this.stage.clear();
        this._painterRegistry.iterateGeneral(painter => {
            painter.clear();
        })
    }
}

export default JCanvas;


function _createDepthTexture(canvas, device) {
    // const depthTexture = device.createTexture({
    //     size: [canvas.width, canvas.height],
    //     format: 'depth24plus',
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    //     label: 'depthTexture',
    // });
    const depthTexture = device.createTexture({
        label: 'depthTexture',
        format: 'depth24plus-stencil8',
        size: [canvas.width, canvas.height],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return depthTexture;
};

function _createRenderPassDescriptor(ctx, stencilTexture) {
    /* return {
        colorAttachments: [
            {
                view: ctx.getCurrentTexture().createView(),
                clearValue: [0, 0, 0, 0],
                loadOp: "clear",
                storeOp: "store",
            }
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        }
    }*/

    return {
        label: 'main render pass',
        colorAttachments: [
            {
                view: ctx.getCurrentTexture().createView(),
                clearValue: [0,0,0,0],
                storeOp: "store",
                loadOp: "clear"
            }
        ],
        depthStencilAttachment: {
            view: stencilTexture.createView(),
            stencilStoreOp: "store",
            stencilLoadOp: "clear",
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store"
        }
    }
}

function _createWorldUniformBuffer(device) {
    return device.createBuffer({
        size: 12 * Float32Array.BYTES_PER_ELEMENT * 3 + Float32Array.BYTES_PER_ELEMENT * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'worldUniformBuffer',
    }); 
}
function _createShapeUniformBuffer(device) {
    return device.createBuffer({
        size: 1 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'shapeUniformBuffer',
    }); 
}

function createScheduleRender(render) {
    let __clock__ = Date.now();
    const t = function () {
        requestAnimationFrame((timestamp) => {
            const isFirstTime = __clock__ !== timestamp
            if(isFirstTime) {
                render();
            }
            __clock__ = timestamp;
            // render();
            // t();
        })
    }

    return t;
}


export * from './texture/gradient';
export * from './texture/image';