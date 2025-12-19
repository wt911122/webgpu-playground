import InstanceConfig from './config';
import { paddingMat3 } from './utils/transform';

class ShaperPainter {
    pipelineRenderer = null;
    instanceRenderer = null;
    // Ctor = null;
    _ctorFnMap = new Map();

    configs = [];
    // _configLength = 0;

    _renderCreator = null;
    _renderTextureCreator = null;
    
    _beforeRenderFn = null;
    _renderFn = null;
    _afterRenderFn = null;

    static = false;

    configsWeakMap = new WeakMap();



    constructor(meta) {
        Object.assign(this, {
            _renderCreator: meta.generateRender,
            _renderTextureCreator: meta.generateTextureRender,
            static: meta.static ?? false,
        });
    }

    init(context) {
        const { 
            beforeRender, 
            render, 
            afterRender,
            collecInstanceConfig,
            afterCollectConfig,
            onPainterCreate,
            renderMaskBegin,
            renderMaskEnd,
        } = this._renderCreator(context);
        let cacheContext;
        this._beforeRenderFn = (encoder) => {
            cacheContext = {}
            beforeRender(encoder, this.configs, cacheContext)
        }
        this._renderFn = (encoder, passEncoder, maskIndex) => {
            render(encoder, passEncoder, maskIndex, this.configs, cacheContext)
        }
        
        this._afterRenderFn = () => {
            afterRender(cacheContext);
            cacheContext = undefined;
        }

        this._collectInstanceConfig = (instance, config, jcanvas) => {
            if(collecInstanceConfig) {
                collecInstanceConfig(instance, config, jcanvas)
            }
        }

        this._afterCollectConfig = () => {
            if(afterCollectConfig) {
                afterCollectConfig(this.configs)
            }
        }

        this._renderMaskBeginFn = (mask, encoder, passEncoder) => {
            if(!renderMaskBegin){
                return;
            }
            const configIndex = this.configs.findIndex(c => c.getInstance() === mask);
            if(configIndex !== -1) {
                renderMaskBegin(encoder, passEncoder, this.configs, configIndex,  cacheContext)
            }
        }
        this._renderMaskEndFn = (mask, encoder, passEncoder) => {
            if(!renderMaskEnd){
                return;
            }
            const configIndex = this.configs.findIndex(c => c.getInstance() === mask);
            if(configIndex !== -1) {
                renderMaskEnd(encoder, passEncoder, this.configs, configIndex, cacheContext)
            }
        }
        if(onPainterCreate) {
            onPainterCreate(this, context);
        }

        if(this._renderTextureCreator) {
            const { 
                renderTexture
            } = this._renderTextureCreator(context);
            this._renderTexture = (instance, config, texture) => {
                renderTexture(instance, config, texture)
            }
        }
    }

    collectFilterPainterConfig(instance, jcanvas) {
        let instanceConfig = this.configsWeakMap.get(instance);
        if(!instanceConfig) {
            instanceConfig = new InstanceConfig(instance, {
                getConfig() {
                    return {
                        _zIndex: instance._zIndex,
                        _opacity: instance._opacity,
                        mat: paddingMat3(instance._currentMat)
                    }
                }
            });
            this.configsWeakMap.set(instance, instanceConfig);
            this.configs.push(instanceConfig);
        } else {
           instanceConfig.updateConfig();
        }
        if(instance._geodirty) {
            this._collectInstanceConfig(instance, instanceConfig, jcanvas);
        }
        return true;
    }

    collectConfig(instance, jcanvas) {
        const configMeta = this.getConfigFnMeta(instance);
        if(!configMeta) {
            return false;
        }

        let instanceConfig = this.configsWeakMap.get(instance);
        
        if(!instanceConfig) {
            instanceConfig = new InstanceConfig(instance, configMeta);
            this.configsWeakMap.set(instance, instanceConfig);
            this.configs.push(instanceConfig);
        } else {
           instanceConfig.updateConfig();
        }
        if(instance._geodirty) {
            this._collectInstanceConfig(instance, instanceConfig, jcanvas);
        }
        // console.log(config)
        // this._configLength = config.length;
        return true;
    }

    getConfigFnMeta(instance) {
        const ctor = instance.constructor;
        return this._ctorFnMap.get(ctor);
    }

    setConfigFnMeta(Ctor, fnName, condition, idx, total) {
        this._ctorFnMap.set(Ctor, {
            fnName, condition, idx, total
        });
    }

    afterCollectConfig() {
        // this.configs.sort((a, b) => a._instance._zIndex - b._instance._zIndex)
        this._afterCollectConfig();
    }

    beforeRender(encoder) {
        if(this.configs.length) {
            this._beforeRenderFn(encoder)
        }
    }

    render(encoder, passEncoder, maskIndex) {
        if(this.static || this.configs.length) {
            this._renderFn(encoder, passEncoder, maskIndex)
        }
    }

    afterRender() {
        if(this.configs.length) {
            this._afterRenderFn()
        }
    }

    renderMaskBegin(mask, encoder, passEncoder) {
        this._renderMaskBeginFn(mask, encoder, passEncoder);
    }

    renderMaskEnd(mask, encoder, passEncoder) {
        this._renderMaskEndFn(mask, encoder, passEncoder);
    }

}

class PainterRegistry {
    _painters = new Map();

    regist(meta) {
        const painter = new ShaperPainter({
            generateRender: meta.generateRender,
            generateTextureRender: meta.generateTextureRender,
            static: meta.static,
        })
        console.log(painter.static)
        this._painters.set(meta.name, painter);
        return painter;
    }

    getPainter(name) {
        return this._painters.get(name);
    }

    iterate(callback, filter) {
        this._painters.forEach(painter => {
            if(!filter || filter(painter)) {
                callback(painter)
            }
        });
    }

    iterateStatic(callback) {
        this.iterate(callback, (painter) => painter.static)
    }

    iterateGeneral(callback) {
        this.iterate(callback, (painter) => !painter.static)
    }

    iterateOnInstance(instance, callback) {
        this.iterate(callback, (painter) => !painter.static && painter.getConfigFnMeta(instance))
    }

    usePainter(ctor, painterName, configFnName, condition, idx, total) {
        const painter = this._painters.get(painterName);
        if(painter) {
            painter.setConfigFnMeta(ctor, configFnName, condition, idx, total);
        }
    }


}

export default PainterRegistry;