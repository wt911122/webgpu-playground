import Layer from './layer';

class Group extends Layer {
    renderable = false;

    static attachPainter() {
        return [];
    }
}

export default Group;