
class Infra {
    constructor(config) {
        this.name = config.name;
        this._setup = config.setup;
    }

    setup(context) {
        this._setup(context);
    }
}

class InfraRegistry {
    _infras = new Map();

    regist(tool) {
        const ifr = new Infra(tool)
        this._infras.set(ifr.name, ifr);
        return ifr;
    }

    setup(context) {
        this._infras.forEach(infra => {
            infra.setup(context);
        });
    }



}

export default InfraRegistry;