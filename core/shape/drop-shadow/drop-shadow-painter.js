import { mat3 } from 'gl-matrix';
import FilterPainter from '../filter/filter-painter';
import InstanceConfig from '../../config'; 
import { paddingMat3 } from '../../utils/transform';

class DropShadowConfig extends InstanceConfig {
    constructor(instance, configMeta = {}) {
        super(instance, configMeta);
        
    }
    updateConfig() {
        this._checkState();
        if(!this.shadowMat){
            this.shadowMat = mat3.create();
        }
        if(this._enable) {
            const instance = this.getInstance();
            const { shadowOffsetX, shadowOffsetY, shadowBlur } = instance;
            mat3.translate(this.shadowMat, instance.matrix, [shadowOffsetX, shadowOffsetY]);
            Object.assign(this._config,  {
                _zIndex: instance._zIndex,
                _opacity: instance._opacity,
                mat: paddingMat3(this.shadowMat),
            });
        }
    }
}

function DropShadowPainter() {
    const {
        generateRender: generateFilterRender
    } = FilterPainter();
    function generateRender(context) {
        const filterRender = generateFilterRender(context);
        
        
        function modifyConfig(instance, config, painter) {
            if(painter.name === 'SDFRectPainter') {
                const _colors = config._colors;
                config._colors = new Float32Array([
                    _colors[8],  _colors[9],  _colors[10],  _colors[11], 
                    0,0,0,0, 
                    0,0,0,0]);
            }
        }

        function collecInstanceConfig(instance, config, jcanvas) {
            if(!config.enable) {
                return;
            }
            
            filterRender.collecInstanceConfig(instance, config, jcanvas, [{
                filter: 'BlurFilter',
                options: {
                    blur: instance.shadowBlur,
                }
            }], modifyConfig);
        }
        function beforeRender(encoder, configs, cacheContext) {
            // console.log('DropShadowPainter beforeRender');
            filterRender.beforeRender(encoder, configs, cacheContext);
        }
        function render(encoder, passEncoder, maskIndex, configs, cacheContext) {
            // console.log('DropShadowPainter render');
            filterRender.render(encoder, passEncoder, maskIndex, configs, cacheContext)
        }
        function afterRender(cacheContext) {
            // console.log('DropShadowPainter afterRender');
            filterRender.afterRender(cacheContext)
        }

        return {
            collecInstanceConfig,
            beforeRender,
            render,
            afterRender, 
        }
    }

    return {
        name: 'DropShadowPainter',
        generateRender,
        configCor: DropShadowConfig,
    }
}

export default DropShadowPainter;