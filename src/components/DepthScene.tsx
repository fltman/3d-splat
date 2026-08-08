import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { HeadPosition } from "../hooks/useHeadTracking";

type DepthSceneProps = {
  imageUrl: string;
  depthUrl: string;
  width: number;
  height: number;
  strength: number;
  showDepth: boolean;
  trackingEnabled: boolean;
  headPosition: MutableRefObject<HeadPosition>;
};

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uPhoto;
  uniform sampler2D uDepth;
  uniform sampler2D uWarpDepth;
  uniform vec2 uViewShift;
  uniform vec2 uDepthTexel;
  uniform float uStrength;
  uniform float uShowDepth;
  varying vec2 vUv;

  float filteredDepth(vec2 coordinate) {
    float center = texture2D(uDepth, coordinate).r;
    float total = center * 2.0;
    float weightTotal = 2.0;
    vec2 offsets[4];
    offsets[0] = vec2(uDepthTexel.x, 0.0);
    offsets[1] = vec2(-uDepthTexel.x, 0.0);
    offsets[2] = vec2(0.0, uDepthTexel.y);
    offsets[3] = vec2(0.0, -uDepthTexel.y);
    for (int index = 0; index < 4; index++) {
      float sampleValue = texture2D(uDepth, clamp(coordinate + offsets[index], 0.0, 1.0)).r;
      float weight = 1.0 - smoothstep(0.035, 0.16, abs(sampleValue - center));
      total += sampleValue * weight;
      weightTotal += weight;
    }
    return total / weightTotal;
  }

  float softWarpDepth(vec2 coordinate) {
    return texture2D(uWarpDepth, coordinate).r;
  }

  void main() {
    float rawMask = filteredDepth(vUv);
    vec3 finalColor = vec3(rawMask);
    float edgeFade =
      smoothstep(0.0, 0.055, vUv.x) *
      smoothstep(0.0, 0.055, vUv.y) *
      smoothstep(0.0, 0.055, 1.0 - vUv.x) *
      smoothstep(0.0, 0.055, 1.0 - vUv.y);

    if (uShowDepth < 0.5) {
      // The displayed photo stays full-resolution. Only this low-frequency
      // coordinate field is softened so occlusion edges cannot tear apart.
      float depth = softWarpDepth(vUv);
      float relief = pow(smoothstep(0.025, 0.975, depth), 1.18) - 0.38;
      vec2 warpedUv = clamp(
        vUv + uViewShift * relief * uStrength * edgeFade,
        vec2(0.001),
        vec2(0.999)
      );
      finalColor = texture2D(uPhoto, warpedUv).rgb;
    }

    gl_FragColor = vec4(finalColor, 1.0);
    #include <colorspace_fragment>
  }
`;

export function DepthScene({
  imageUrl,
  depthUrl,
  width,
  height,
  strength,
  showDepth,
  trackingEnabled,
  headPosition,
}: DepthSceneProps) {
  const mount = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = mount.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    camera.position.set(0, 0, 3.35);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x080907, 1);
    container.appendChild(renderer.domElement);

    const aspect = width / height;
    const loader = new THREE.TextureLoader();
    const photoTexture = loader.load(imageUrl);
    photoTexture.colorSpace = THREE.SRGBColorSpace;
    photoTexture.minFilter = THREE.LinearFilter;
    photoTexture.magFilter = THREE.LinearFilter;
    const depthTexture = loader.load(depthUrl);
    depthTexture.minFilter = THREE.LinearFilter;
    depthTexture.magFilter = THREE.LinearFilter;

    // Parallax uses a deliberately low-frequency copy of the depth map. This
    // keeps connected objects intact at occlusion edges while the photo itself
    // remains sampled at its original resolution.
    const warpCanvas = document.createElement("canvas");
    const warpLongEdge = 72;
    if (aspect >= 1) {
      warpCanvas.width = warpLongEdge;
      warpCanvas.height = Math.max(40, Math.round(warpLongEdge / aspect));
    } else {
      warpCanvas.height = warpLongEdge;
      warpCanvas.width = Math.max(40, Math.round(warpLongEdge * aspect));
    }
    const warpContext = warpCanvas.getContext("2d")!;
    warpContext.imageSmoothingEnabled = true;
    warpContext.imageSmoothingQuality = "high";
    warpContext.fillStyle = "#000";
    warpContext.fillRect(0, 0, warpCanvas.width, warpCanvas.height);
    const warpDepthTexture = new THREE.CanvasTexture(warpCanvas);
    warpDepthTexture.minFilter = THREE.LinearFilter;
    warpDepthTexture.magFilter = THREE.LinearFilter;
    warpDepthTexture.generateMipmaps = false;

    depthTexture.onUpdate = () => {
      const image = depthTexture.image as CanvasImageSource | undefined;
      if (!image) return;
      warpContext.clearRect(0, 0, warpCanvas.width, warpCanvas.height);
      warpContext.drawImage(image, 0, 0, warpCanvas.width, warpCanvas.height);
      warpDepthTexture.needsUpdate = true;
    };

    const planeHeight = 2.05;
    const planeWidth = planeHeight * aspect;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPhoto: { value: photoTexture },
        uDepth: { value: depthTexture },
        uWarpDepth: { value: warpDepthTexture },
        uViewShift: { value: new THREE.Vector2(0, 0) },
        uDepthTexel: { value: new THREE.Vector2(1 / 1280, 1 / 1280) },
        uStrength: { value: strength },
        uShowDepth: { value: showDepth ? 1 : 0 },
      },
      vertexShader,
      fragmentShader,
      toneMapped: false,
    });
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const frameMaterial = new THREE.MeshBasicMaterial({ color: 0x181a16, toneMapped: false });
    const frameDepth = 0.065;
    const thickness = 0.035;
    const horizontal = new THREE.BoxGeometry(planeWidth + thickness * 2, thickness, frameDepth);
    const vertical = new THREE.BoxGeometry(thickness, planeHeight, frameDepth);
    const top = new THREE.Mesh(horizontal, frameMaterial);
    const bottom = new THREE.Mesh(horizontal, frameMaterial);
    const left = new THREE.Mesh(vertical, frameMaterial);
    const right = new THREE.Mesh(vertical, frameMaterial);
    top.position.set(0, planeHeight / 2 + thickness / 2, 0.02);
    bottom.position.set(0, -planeHeight / 2 - thickness / 2, 0.02);
    left.position.set(-planeWidth / 2 - thickness / 2, 0, 0.02);
    right.position.set(planeWidth / 2 + thickness / 2, 0, 0.02);
    scene.add(top, bottom, left, right);

    let animation = 0;
    let currentX = 0;
    let currentY = 0;
    let currentZ = 0;
    let cameraDistance = 3.35;

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / Math.max(bounds.height, 1);
      camera.updateProjectionMatrix();
      const viewAspect = bounds.width / Math.max(bounds.height, 1);
      cameraDistance = viewAspect < aspect ? 3.35 * (aspect / viewAspect) * 0.7 + 0.8 : 3.35;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const move = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      pointer.current.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.current.y = -((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    const leave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerleave", leave);

    const render = () => {
      const head = headPosition.current;
      const useHead = trackingEnabled && head.confidence > 0.05;
      const inspectingDepth = material.uniforms.uShowDepth.value > 0.5;
      const targetX = inspectingDepth ? 0 : useHead ? head.x * 1.9 : pointer.current.x;
      const targetY = inspectingDepth ? 0 : useHead ? head.y * 1.75 : pointer.current.y;
      const targetZ = inspectingDepth ? 0 : useHead ? head.z : 0;
      currentX += (THREE.MathUtils.clamp(targetX, -1.35, 1.35) - currentX) * 0.075;
      currentY += (THREE.MathUtils.clamp(targetY, -1.2, 1.2) - currentY) * 0.075;
      currentZ += (targetZ - currentZ) * 0.05;

      // Moving the head right reveals the scene from the right, so foreground
      // pixels move left relative to the background.
      material.uniforms.uViewShift.value.set(-currentX * 0.19, -currentY * 0.135);
      camera.position.z = cameraDistance - currentZ * 0.08;
      renderer.render(scene, camera);
      animation = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", leave);
      geometry.dispose();
      material.dispose();
      horizontal.dispose();
      vertical.dispose();
      frameMaterial.dispose();
      photoTexture.dispose();
      depthTexture.dispose();
      warpDepthTexture.dispose();
      renderer.dispose();
      materialRef.current = null;
      renderer.domElement.remove();
    };
  }, [depthUrl, headPosition, height, imageUrl, trackingEnabled, width]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uStrength.value = strength;
    materialRef.current.uniforms.uShowDepth.value = showDepth ? 1 : 0;
  }, [showDepth, strength]);

  return <div className="depth-scene" ref={mount} aria-label="Interaktiv djupscen" />;
}
