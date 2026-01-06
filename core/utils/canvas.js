export function createCanvas(wrapper){
    const { width, height } = wrapper.getBoundingClientRect();
    const meta = createRawCanvas(width, height);
    if(wrapper) {
        wrapper.style.position = 'relative';
        wrapper.style.overflow = 'hidden';
        wrapper.append(meta.canvas);
    }
    return meta;
}

export function createRawCanvas(width, height) {
     const canvas = document.createElement('canvas');
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.style.userSelect = 'none';
    const DPR = window.devicePixelRatio;
    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    const ctx = canvas.getContext('webgpu');
    return {
        canvas,
        width,
        height,
        raw_width: canvas.width,
        raw_height: canvas.height,
        ctx,
        DPR,
    }
}