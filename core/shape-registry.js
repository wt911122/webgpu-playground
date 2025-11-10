import InstanceConfig from './config';

class ShaperPainter {
    pipelineRenderer = null;
    instanceRenderer = null;
    // Ctor = null;
    _ctorFnMap = new Map();

    configs = [];
    // _configLength = 0;

    _renderCreator = null;
    
    _beforeRenderFn = null;
    _renderFn = null;
    _afterRenderFn = null;

    configsWeakMap = new WeakMap();


    constructor(meta) {
        Object.assign(this, {
            _renderCreator: meta.generateRender,
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
        } = this._renderCreator(context);
        let cacheContext;
        this._beforeRenderFn = (encoder) => {
            cacheContext = {}
            beforeRender(encoder, this.configs, cacheContext)
        }
        this._renderFn = (encoder, passEncoder) => {
            render(encoder, passEncoder, this.configs, cacheContext)
        }
        this._afterRenderFn = () => {
            afterRender(cacheContext);
            cacheContext = undefined;
        }

        this._collectInstanceConfig = (instance, config) => {
            if(collecInstanceConfig) {
                collecInstanceConfig(instance, config)
            }
        }

        this._afterCollectConfig = () => {
            if(afterCollectConfig) {
                afterCollectConfig(this.configs)
            }
        }
        if(onPainterCreate) {
            onPainterCreate(this, context);
        }
    }

    collectConfig(instance) {
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
            this._collectInstanceConfig(instance, instanceConfig);
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

    render(encoder, passEncoder) {
        if(this.configs.length) {
            this._renderFn(encoder, passEncoder)
        }
    }

    afterRender() {
        if(this.configs.length) {
            this._afterRenderFn()
        }
    }

}

class PainterRegistry {
    _painters = new Map();

    regist(meta) {
        const painter = new ShaperPainter({
            generateRender: meta.generateRender,
        })
        this._painters.set(meta.name, painter);
        return painter;
    }

    iterate(callback) {
        this._painters.forEach(painter => {
            callback(painter)
        });
    }

    usePainter(ctor, painterName, configFnName, condition, idx, total) {
        const painter = this._painters.get(painterName);
        if(painter) {
            painter.setConfigFnMeta(ctor, configFnName, condition, idx, total);
        }
       
    }
}

export default PainterRegistry;