const commandLines = 30000;
class Command {
    type = 'render';
    painter = undefined
    configIndex = undefined;
    maskLayer = undefined;
    maskIndex = undefined;
    reference = 0;

    update(type, value, painter, maskIndex, maskLayer) {
        this.type = type;
        this.painter = painter;
        this.maskIndex = maskIndex;
        this.maskLayer = maskLayer;
        switch(type) {
            case 'render':
            case 'renderMaskBegin':
            case 'renderMaskEnd':
                this.configIndex = value;
                break;
            case 'stencil':
                this.reference = value; 
                break;
        }
    }

    exec(passEncoder, context) {
        switch(this.type) {
            case 'render':
                if(context.lastPainter !== this.painter) {
                    this.painter._usePipeline(passEncoder);
                    context.lastPainter =  this.painter;
                }
                this.painter._renderInstance(passEncoder, this.configIndex);
                break;
            case 'renderMaskBegin':
                context.lastPainter = undefined;
                this.painter._renderMaskBegin(passEncoder, this.configIndex);
                break;
            case 'renderMaskEnd':
                context.lastPainter = undefined;
                this.painter._renderMaskEnd(passEncoder, this.configIndex);
                break;
            case 'stencil':
                passEncoder.setStencilReference(this.reference);
                break;
        }
    }
}

class Commander {
    _idx = 0;
    _endidx = 0;
    commands = [];
    
    constructor() {
        this.prepareCommands(commandLines);
    }

    prepareCommands(num) {
        for(let i =0;i<num;i++) {
            this.commands.push(new Command());
        }
    }

    reset() {
        this._idx = 0;
    }
    end() {
        this._endidx = this._idx;
    }

    addCommand(type, ...argus) {
        if(!this.commands[this._idx]) {
            this.prepareCommands(200);
        }
        this.commands[this._idx].update(type, ...argus);
        this._idx ++;
    }
    exec(passEncoder) {
        const context = { lastPainter: undefined };
        const l = this._endidx;
        const cmds = this.commands;
        for(let i=0;i<l;i++) {
            cmds[i].exec(passEncoder, context);
        }
    }
}

export default Commander;