export function createCanvas(wrapper){
    const canvas = document.createElement('canvas');
    const { width, height, left, top } = wrapper.getBoundingClientRect();
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.style.userSelect = 'none';
    const DPR = window.devicePixelRatio;
    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    if(wrapper) {
        wrapper.style.position = 'relative';
        wrapper.style.overflow = 'hidden';
        wrapper.append(canvas);
    }
    const ctx = canvas.getContext('webgpu');
    return {
        canvas,
        width,
        height,
        raw_width: canvas.width,
        raw_height: canvas.height,
        left,
        top,
        ctx,
        DPR,
    }
}