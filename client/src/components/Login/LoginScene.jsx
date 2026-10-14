import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import styles from './LoginScene.module.css';

function FloatingPolyhedron() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshStandardMaterial
          color="#6c3ce0"
          wireframe
          transparent
          opacity={0.35}
          emissive="#a78bfa"
          emissiveIntensity={0.2}
        />
      </mesh>
    </Float>
  );
}

function FloatingRing() {
  const ringRef = useRef();

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.x -= delta * 0.15;
      ringRef.current.rotation.z += delta * 0.25;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.8} floatIntensity={1}>
      <mesh ref={ringRef} position={[0, 0, 0]}>
        <torusGeometry args={[3.2, 0.05, 16, 100]} />
        <meshStandardMaterial
          color="#a78bfa"
          emissive="#6c3ce0"
          emissiveIntensity={0.4}
          transparent
          opacity={0.4}
        />
      </mesh>
    </Float>
  );
}

export default function LoginScene() {
  return (
    <div className={styles.sceneContainer}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        style={{ pointerEvents: 'none' }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#a78bfa" />
        <pointLight position={[-10, -10, -5]} intensity={0.8} color="#6c3ce0" />
        
        <Stars
          radius={50}
          depth={50}
          count={1200}
          factor={3}
          saturation={0.5}
          fade
          speed={1}
        />
        
        <FloatingPolyhedron />
        <FloatingRing />
      </Canvas>
    </div>
  );
}
