
import React, { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { TreeContext, TreeContextType } from '../types';

const CrystalOrnaments: React.FC = () => {
  // 1. 引入 panOffset
  const { state, rotationSpeed, panOffset, ornamentTheme } = useContext(TreeContext) as TreeContextType;
  const groupRef = useRef<THREE.Group>(null);

  const progress = useRef(0);
  const treeRotation = useRef(0);

  // 2. 增加平滑位移 Ref
  const currentPan = useRef({ x: 0, y: 0 });

  const palettes = useMemo(() => ([
    ['#D32F2F', '#FFD700', '#2E7D32'], // 经典红金绿
    ['#5AD7FF', '#C7F9FF', '#8B5CF6'], // 冰蓝 + 霓虹紫
    ['#FF9AA2', '#FFDAC1', '#FFB347'] // 糖果粉橙
  ]), []);
  const themeColors = palettes[((ornamentTheme % palettes.length) + palettes.length) % palettes.length];

  const ornaments = useMemo(() => {
    const count = 50; // 减少装饰物数量，让照片更突出
    const items = [];

    const colors = themeColors;

    for (let i = 0; i < count; i++) {
      // Tree Form Data
      const t = i / count;
      const h = t * 11 - 5.5;
      const r = (6 - (h + 5.5)) * 0.5 + 0.5;
      const angle = t * Math.PI * 13;

      // Chaos Form Data (Outside photos)
      const radius = 10 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const chaosPos = [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      ];

      // Type
      const type = Math.random() > 0.5 ? 'sphere' : 'box';

      // Random color
      const color = colors[Math.floor(Math.random() * colors.length)];

      items.push({
        id: i,
        chaosPos: new THREE.Vector3(...chaosPos),
        treeCyl: { h, r, angle },
        type,
        color,
        scale: Math.random() * 0.2 + 0.15
      });
    }
    return items;
  }, [themeColors]);

  useFrame((state3d, delta) => {
    const targetProgress = state === 'FORMED' ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, targetProgress, 2.0, delta);
    const p = progress.current;
    const ease = p * p * (3 - 2 * p);

    const spinFactor = state === 'FORMED' ? rotationSpeed : 0.05;
    treeRotation.current += spinFactor * delta;

    // 3. 应用平移逻辑 (与 TreeSystem 保持一致)
    // 允许在任何状态下平移，使用较快的跟随速度
    const targetPanX = panOffset.x;
    const targetPanY = panOffset.y;

    currentPan.current.x = THREE.MathUtils.lerp(currentPan.current.x, targetPanX, 0.2);
    currentPan.current.y = THREE.MathUtils.lerp(currentPan.current.y, targetPanY, 0.2);

    if (groupRef.current) {
      groupRef.current.position.x = currentPan.current.x;
      groupRef.current.position.y = currentPan.current.y;

      groupRef.current.children.forEach((child, i) => {
        if (child.name === 'STAR') {
          const starY = THREE.MathUtils.lerp(10, 7.5, ease);
          child.position.set(0, starY, 0);
          child.rotation.y += delta * 0.8;
          const pulse = 1.0 + Math.sin(state3d.clock.elapsedTime * 4) * 0.12;
          child.scale.setScalar(THREE.MathUtils.lerp(0, 1.3 * pulse, ease));
          const light = child.children.find(c => (c as any).isPointLight) as THREE.PointLight | undefined;
          if (light) {
            light.intensity = 2 + Math.sin(state3d.clock.elapsedTime * 3) * 0.5;
            light.distance = 9;
            light.decay = 1.8;
          }
          return;
        }

        const data = ornaments[i];
        if (!data) return;

        const cx = data.chaosPos.x;
        const cy = data.chaosPos.y;
        const cz = data.chaosPos.z;
        const cr = Math.sqrt(cx * cx + cz * cz);
        const cAngle = Math.atan2(cz, cx);

        const { h, r, angle } = data.treeCyl;

        const y = THREE.MathUtils.lerp(cy, h, ease);
        const currentR = THREE.MathUtils.lerp(cr, r, ease);

        const vortexTwist = (1 - ease) * 12.0;
        const currentAngle = angle + vortexTwist + treeRotation.current;

        const cRotatedX = cr * Math.cos(cAngle + treeRotation.current * 0.1);
        const cRotatedZ = cr * Math.sin(cAngle + treeRotation.current * 0.1);

        const tX = currentR * Math.cos(currentAngle);
        const tZ = currentR * Math.sin(currentAngle);

        const bob = Math.sin(state3d.clock.elapsedTime * 1.2 + i) * 0.05;
        child.position.x = THREE.MathUtils.lerp(cRotatedX, tX, ease);
        child.position.y = y + bob;
        child.position.z = THREE.MathUtils.lerp(cRotatedZ, tZ, ease);

        // 玻璃/金属质感 & 慢速自旋
        child.rotation.x += delta * (0.5 - ease * 0.2);
        child.rotation.y += delta * (0.8 - ease * 0.3);
      });
    }
  });

  return (
    <group ref={groupRef}>
      {ornaments.map((o, i) => (
        <mesh key={i} scale={o.scale * 0.7} castShadow receiveShadow>
          {o.type === 'sphere' && <sphereGeometry args={[1, 16, 16]} />}
          {o.type === 'box' && <boxGeometry args={[1, 1, 1]} />}

          <meshStandardMaterial
            color={o.color}
            roughness={0.18}
            metalness={0.82}
            emissive={o.color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.85}
            envMapIntensity={1.5}
          />
        </mesh>
      ))}

      {/* TOP STAR - 保持醒目 */}
      <mesh name="STAR" position={[0, 7.5, 0]}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial
          color="#ffdd00"
          emissive="#ffaa00"
          emissiveIntensity={3}
          roughness={0.15}
          metalness={1.0}
          toneMapped={false}
        />
        <pointLight intensity={2} color="#ffbb55" distance={9} decay={1.8} />
      </mesh>
      <Sparkles count={50} scale={1.5} size={8} speed={0.8} opacity={0.6} color="#ffd699" position={[0, 7.8, 0]} />
    </group>
  );
};

export default CrystalOrnaments;
