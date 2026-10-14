import * as THREE from "three";
import { TILE } from "../world/blocks";

const vertexShader = /* glsl */ `
  attribute vec4 a_pos;
  attribute vec2 a_uv;
  attribute vec4 a_light;
  varying vec3 v_uv;
  varying vec2 v_light;
  varying float v_shade;
  varying float v_ao;
  varying float v_fog;
  void main() {
    vec3 p = a_pos.xyz / 16.0;
    float face = a_pos.w;
    v_shade = face < 1.5 ? 0.6 : face < 2.5 ? 1.0 : face < 3.5 ? 0.5 : face < 5.5 ? 0.8 : 0.9;
    v_uv = vec3(a_uv / 16.0, a_light.x);
    v_light = a_light.yz / 15.0;
    v_ao = a_light.w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    v_fog = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp sampler2DArray;
  uniform sampler2DArray u_atlas;
  uniform float u_daylight;
  uniform vec3 u_skyTint;
  uniform vec3 u_fogColor;
  uniform float u_fogNear;
  uniform float u_fogFar;
  uniform float u_time;
  uniform float u_waterLayer;
  uniform float u_opacity;
  uniform float u_alphaTest;
  uniform vec2 u_lightOverride;
  varying vec3 v_uv;
  varying vec2 v_light;
  varying float v_shade;
  varying float v_ao;
  varying float v_fog;

  float curve(float f) {
    float b = f / (4.0 - 3.0 * f);
    return mix(b, f, 0.4);
  }

  void main() {
    vec2 uv = v_uv.xy;
    if (abs(v_uv.z - u_waterLayer) < 0.5) {
      float row = floor(fract(uv.y) * 16.0);
      uv.x += floor(sin(u_time * 1.6 + row * 0.8) * 1.5 + 0.5) / 16.0;
    }
    vec4 tex = texture(u_atlas, vec3(uv, v_uv.z));
    if (tex.a < u_alphaTest) discard;
    vec2 lightLevels = u_lightOverride.x >= 0.0 ? u_lightOverride : v_light;
    float sky = curve(lightLevels.x * u_daylight);
    float blk = curve(lightLevels.y);
    vec3 light = max(vec3(sky) * u_skyTint, vec3(blk) * vec3(1.0, 0.86, 0.66)) + 0.03;
    float ao = 1.0 - v_ao * 0.17;
    vec3 col = tex.rgb * light * v_shade * ao;
    float fog = smoothstep(u_fogNear, u_fogFar, v_fog);
    gl_FragColor = vec4(mix(col, u_fogColor, fog), tex.a * u_opacity);
  }
`;

export interface WorldUniforms {
  u_atlas: { value: THREE.Texture };
  u_daylight: { value: number };
  u_skyTint: { value: THREE.Vector3 };
  u_fogColor: { value: THREE.Vector3 };
  u_fogNear: { value: number };
  u_fogFar: { value: number };
  u_time: { value: number };
  u_waterLayer: { value: number };
}

export function createWorldUniforms(atlas: THREE.Texture): WorldUniforms {
  return {
    u_atlas: { value: atlas },
    u_daylight: { value: 1 },
    u_skyTint: { value: new THREE.Vector3(1, 1, 1) },
    u_fogColor: { value: new THREE.Vector3(0.7, 0.82, 1) },
    u_fogNear: { value: 80 },
    u_fogFar: { value: 120 },
    u_time: { value: 0 },
    u_waterLayer: { value: TILE.water },
  };
}

export interface BlockMaterials {
  solid: THREE.ShaderMaterial;
  water: THREE.ShaderMaterial;
  /** Same shader with light supplied per object (dropped items, held item). */
  entity: () => THREE.ShaderMaterial;
}

export function createBlockMaterials(uniforms: WorldUniforms): BlockMaterials {
  const make = (extra: Record<string, { value: unknown }>, params: THREE.ShaderMaterialParameters) =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { ...uniforms, ...extra },
      ...params,
    });
  const solid = make(
    { u_opacity: { value: 1 }, u_alphaTest: { value: 0.5 }, u_lightOverride: { value: new THREE.Vector2(-1, -1) } },
    { side: THREE.FrontSide },
  );
  const water = make(
    { u_opacity: { value: 0.78 }, u_alphaTest: { value: 0.01 }, u_lightOverride: { value: new THREE.Vector2(-1, -1) } },
    { side: THREE.DoubleSide, transparent: true, depthWrite: false },
  );
  const entity = () =>
    make(
      { u_opacity: { value: 1 }, u_alphaTest: { value: 0.5 }, u_lightOverride: { value: new THREE.Vector2(1, 0) } },
      { side: THREE.FrontSide },
    );
  return { solid, water, entity };
}
