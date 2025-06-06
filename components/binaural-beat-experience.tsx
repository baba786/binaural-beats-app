"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Volume2, VolumeX, Play, Pause, MoreHorizontal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BinauralBeats } from "@/components/BinauralBeats";
import { NoiseGenerator } from "@/components/NoiseGenerator";
import { createOmSound } from '@/utils/omSound';
import { createNoise as createEnhancedNoise } from '@/utils/audioUtils';
import { StereoEnhancer, PsychoacousticProcessor } from '@/utils/advancedAudioProcessors';

// ------------------------------------------------------------------------------------
//   PLACEHOLDER COMPONENTS
//   Remove or replace these with your real BinauralBeats and NoiseGenerator.
// ------------------------------------------------------------------------------------
// function BinauralBeats({
//   beatFrequency,
//   setBeatFrequency,
// }: {
//   beatFrequency: number;
//   setBeatFrequency: (val: number) => void;
// }) {
//   return (
//     <div className="space-y-4 mt-4">
//       <Label>Binaural Beat Frequency: {beatFrequency.toFixed(1)} Hz</Label>
//       <Slider
//         min={1}
//         max={30}
//         step={0.5}
//         value={[beatFrequency]}
//         onValueChange={(value) => setBeatFrequency(value[0])}
//       />
//     </div>
//   );
// }

// function NoiseGenerator({
//   noiseType,
//   setNoiseType,
// }: {
//   noiseType: string;
//   setNoiseType: (type: any) => void;
// }) {
//   return (
//     <div className="space-y-4 mt-4">
//       <Label>Noise Type: {noiseType}</Label>
//       {/* Replace with your real UI; for now, just a few buttons */}
//       <div className="flex space-x-2">
//         {["white", "pink", "brown"].map((type) => (
//           <Button
//             key={type}
//             variant={noiseType === type ? "default" : "secondary"}
//             onClick={() => setNoiseType(type)}
//           >
//             {type}
//           </Button>
//         ))}
//       </div>
//     </div>
//   );
// }
// ------------------------------------------------------------------------------------

/** 
 * Utility to fade in/out edges of the audio buffer to prevent clicking/popping
 */
export function applyFadeInOut(channelData: Float32Array, sampleRate: number) {
  const fadeTime = 0.05; // 50ms fade in/out
  const fadeSamples = Math.floor(fadeTime * sampleRate);
  
  // Apply fade in
  for (let i = 0; i < fadeSamples; i++) {
    const gain = i / fadeSamples;
    channelData[i] *= gain;
  }
  
  // Apply fade out
  for (let i = 0; i < fadeSamples; i++) {
    const gain = i / fadeSamples;
    const index = channelData.length - 1 - i;
    if (index >= 0) {
      channelData[index] *= gain;
    }
  }
}

/**
 * Enhanced binaural beat generator with premium audio quality
 */
export function createEnhancedBinauralBeats(
  ctx: AudioContext, 
  carrierFreq: number = 250, 
  beatFreq: number = 10,
  stereoWidth: number = 1.0
) {
  // Create oscillators for left and right channels
  const leftOsc = ctx.createOscillator();
  const rightOsc = ctx.createOscillator();
  
  // Enhanced frequencies with slight detuning for richer sound
  leftOsc.frequency.setValueAtTime(carrierFreq - beatFreq / 2, ctx.currentTime);
  rightOsc.frequency.setValueAtTime(carrierFreq + beatFreq / 2, ctx.currentTime);
  
  // Use sine waves for purest binaural effect
  leftOsc.type = 'sine';
  rightOsc.type = 'sine';
  
  // Create gain nodes for volume control and processing
  const leftGain = ctx.createGain();
  const rightGain = ctx.createGain();
  const masterGain = ctx.createGain();
  
  // Create stereo panner for enhanced imaging
  const stereoPanner = ctx.createStereoPanner();
  
  // Create a subtle low-pass filter to reduce harshness
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(8000, ctx.currentTime);
  filter.Q.setValueAtTime(0.707, ctx.currentTime);
  
  // Create a compressor for dynamic range control
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, ctx.currentTime);
  compressor.knee.setValueAtTime(30, ctx.currentTime);
  compressor.ratio.setValueAtTime(4, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.25, ctx.currentTime);
  
  // Set initial gains with smooth transitions
  const initialGain = 0.3;
  leftGain.gain.setValueAtTime(initialGain, ctx.currentTime);
  rightGain.gain.setValueAtTime(initialGain, ctx.currentTime);
  masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
  
  // Connect the audio graph with enhanced processing
  leftOsc.connect(leftGain);
  rightOsc.connect(rightGain);
  
  // Create a merger to combine left and right channels
  const merger = ctx.createChannelMerger(2);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  
  // Connect to processing chain
  merger.connect(filter);
  filter.connect(compressor);
  compressor.connect(stereoPanner);
  stereoPanner.connect(masterGain);
  
  // Enhanced frequency update function with smooth transitions
  const updateFrequencies = (newCarrier: number, newBeat: number) => {
    const now = ctx.currentTime;
    const transitionTime = 0.1; // 100ms smooth transition
    
    leftOsc.frequency.exponentialRampToValueAtTime(newCarrier - newBeat / 2, now + transitionTime);
    rightOsc.frequency.exponentialRampToValueAtTime(newCarrier + newBeat / 2, now + transitionTime);
    
    // Adjust filter frequency based on carrier for optimal psychoacoustic response
    const filterFreq = Math.min(8000, newCarrier * 16);
    filter.frequency.exponentialRampToValueAtTime(filterFreq, now + transitionTime);
  };
  
  return {
    leftOsc,
    rightOsc,
    leftGain,
    rightGain,
    masterGain,
    stereoPanner,
    filter,
    compressor,
    updateFrequencies,
    destination: masterGain
  };
}

/**
 * High-quality real-time noise generation for different noise colors
 */
export function createNoise(ctx: AudioContext, noiseType: string) {
  // For rain, we'll still use a buffer-based approach as it's more complex
  if (noiseType === "rain") {
    return createBufferNoise(ctx, noiseType);
  }

  // Set up for real-time generation
  // Use larger buffer size for better performance
  const bufferSize = 4096;
  let processorNode;
  
  try {
    // First try to use AudioWorkletNode if available (modern browsers)
    if (ctx.audioWorklet && typeof window !== 'undefined' && 
        'AudioWorkletNode' in window) {
      // Create a processor node using AudioWorklet (modern approach)
      return createAudioWorkletNoise(ctx, noiseType);
    } else {
      // Fallback to ScriptProcessorNode (older browsers)
      processorNode = ctx.createScriptProcessor(bufferSize, 1, 2);
      console.log("Using ScriptProcessorNode for real-time noise generation");
    }
  } catch (e) {
    console.error("Error creating AudioWorklet, falling back to ScriptProcessor:", e);
    processorNode = ctx.createScriptProcessor(bufferSize, 1, 2);
  }

  // Create filter parameters based on noise type
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let lastOutputL = 0, lastOutputR = 0;
  
  // For brown and pink noise
  const brownFilter = { lastValueL: 0, lastValueR: 0 };
  
  // Pink noise requires more precise filtering
  const pinkFilter = {
    b0L: 0, b1L: 0, b2L: 0, b3L: 0, b4L: 0, b5L: 0,
    b0R: 0, b1R: 0, b2R: 0, b3R: 0, b4R: 0, b5R: 0,
  };

  // Continuous real-time noise generation
  processorNode.onaudioprocess = (audioProcessingEvent) => {
    const outputBuffer = audioProcessingEvent.outputBuffer;
    const leftOutput = outputBuffer.getChannelData(0);
    const rightOutput = outputBuffer.getChannelData(1);
    
    // Generate different noise types
    for (let i = 0; i < outputBuffer.length; i++) {
      // Generate slightly different values for left/right for better stereo image
      const whiteNoiseL = Math.random() * 2 - 1;
      const whiteNoiseR = Math.random() * 2 - 1;
      
      let outputL, outputR;
      
      switch (noiseType) {
        case "pink":
          // Pink noise using Paul Kellet's refined method (better quality)
          // Left channel
          pinkFilter.b0L = 0.99886 * pinkFilter.b0L + whiteNoiseL * 0.0555179;
          pinkFilter.b1L = 0.99332 * pinkFilter.b1L + whiteNoiseL * 0.0750759;
          pinkFilter.b2L = 0.96900 * pinkFilter.b2L + whiteNoiseL * 0.1538520;
          pinkFilter.b3L = 0.86650 * pinkFilter.b3L + whiteNoiseL * 0.3104856;
          pinkFilter.b4L = 0.55000 * pinkFilter.b4L + whiteNoiseL * 0.5329522;
          pinkFilter.b5L = -0.7616 * pinkFilter.b5L - whiteNoiseL * 0.0168980;
          outputL = (pinkFilter.b0L + pinkFilter.b1L + pinkFilter.b2L + pinkFilter.b3L + 
                     pinkFilter.b4L + pinkFilter.b5L + whiteNoiseL * 0.5362) * 0.11;
          
          // Right channel
          pinkFilter.b0R = 0.99886 * pinkFilter.b0R + whiteNoiseR * 0.0555179;
          pinkFilter.b1R = 0.99332 * pinkFilter.b1R + whiteNoiseR * 0.0750759;
          pinkFilter.b2R = 0.96900 * pinkFilter.b2R + whiteNoiseR * 0.1538520;
          pinkFilter.b3R = 0.86650 * pinkFilter.b3R + whiteNoiseR * 0.3104856;
          pinkFilter.b4R = 0.55000 * pinkFilter.b4R + whiteNoiseR * 0.5329522;
          pinkFilter.b5R = -0.7616 * pinkFilter.b5R - whiteNoiseR * 0.0168980;
          outputR = (pinkFilter.b0R + pinkFilter.b1R + pinkFilter.b2R + pinkFilter.b3R + 
                     pinkFilter.b4R + pinkFilter.b5R + whiteNoiseR * 0.5362) * 0.11;
          break;
          
        case "brown":
          // High-quality brown noise (proper 1/f² spectrum)
          // Using leaky integrator for continuous sound
          brownFilter.lastValueL = (0.97 * brownFilter.lastValueL) + (0.03 * whiteNoiseL);
          brownFilter.lastValueR = (0.97 * brownFilter.lastValueR) + (0.03 * whiteNoiseR);
          outputL = brownFilter.lastValueL * 3.5; // Gain to bring to similar levels
          outputR = brownFilter.lastValueR * 3.5;
          break;
          
        case "blue":
          // Real-time blue noise - first-order differentiation
          outputL = whiteNoiseL - lastOutputL;
          outputR = whiteNoiseR - lastOutputR;
          lastOutputL = whiteNoiseL;
          lastOutputR = whiteNoiseR;
          // Scale to prevent clipping
          outputL *= 0.5;
          outputR *= 0.5;
          break;
          
        case "violet":
          // Violet noise - second-order differentiation
          const tempL = whiteNoiseL - lastOutputL;
          const tempR = whiteNoiseR - lastOutputR;
          outputL = tempL - b0;
          outputR = tempR - b1;
          b0 = tempL;
          b1 = tempR;
          // Scale to prevent clipping
          outputL *= 0.25;
          outputR *= 0.25;
          break;
          
        case "green":
          // Green noise - mid-emphasis using basic IIR bandpass
          // Simple mid-pass filter
          const x0L = whiteNoiseL;
          const x0R = whiteNoiseR;
          outputL = 0.30 * x0L + 0.40 * b2 - 0.70 * b4;
          outputR = 0.30 * x0R + 0.40 * b3 - 0.70 * b5;
          b4 = b2;
          b5 = b3;
          b2 = x0L;
          b3 = x0R;
          // Boost to compensate for filter loss
          outputL *= 2.0;
          outputR *= 2.0;
          break;
          
        case "gray":
          // Gray noise - perceptually flat equalization 
          const input = whiteNoiseL;
          // Simple psychoacoustic filter approximation
          outputL = 0.50 * input + 0.25 * b6 - 0.10 * lastOutputL;
          outputR = 0.50 * whiteNoiseR + 0.25 * b6 - 0.10 * lastOutputR;
          b6 = input;
          lastOutputL = outputL;
          lastOutputR = outputR;
          // Boost to match levels
          outputL *= 1.8;
          outputR *= 1.8;
          break;
          
        default:
          // White noise - plain uniform random
          outputL = whiteNoiseL;
          outputR = whiteNoiseR;
      }
      
      // Soft-clipping to prevent digital distortion
      leftOutput[i] = Math.tanh(outputL);
      rightOutput[i] = Math.tanh(outputR);
    }
  };

  // Create gain node for volume control
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.7, ctx.currentTime); // Lower default gain
  
  // Create compressor for better dynamics
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 20;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.05;

  // Connect nodes: processor -> gain -> compressor -> destination
  processorNode.connect(noiseGain);
  noiseGain.connect(compressor);
  compressor.connect(ctx.destination);
  
  // Return with the same interface as the buffer-based approach
  return { 
    noiseSource: processorNode, 
    noiseGain: noiseGain
  };
}

/**
 * Create buffer-based noise (for rain sounds and fallback)
 */
function createBufferNoise(ctx: AudioContext, noiseType: string) {
  // Create a buffer with increased size for less obvious looping
  const bufferSize = ctx.sampleRate * 5; // 5 seconds buffer (longer than original)
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  
  // Create stereo channels
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);
  
  // Fill buffer with appropriate noise type
  try {
    // Generate the specific noise type
    switch (noiseType) {
      case "white":
        generateWhiteNoise(leftChannel, rightChannel);
        break;
      case "pink":
        generatePinkNoise(leftChannel, rightChannel);
        break;
      case "brown":
        generateBrownNoise(leftChannel, rightChannel);
        break;
      case "blue":
        generateBlueNoise(leftChannel, rightChannel);
        break;
      case "violet":
        generateVioletNoise(leftChannel, rightChannel);
        break;
      case "green":
        generateGreenNoise(leftChannel, rightChannel);
        break;
      case "gray":
        generateGrayNoise(leftChannel, rightChannel);
        break;
      case "rain":
        generateRainSound(leftChannel, rightChannel, ctx.sampleRate);
        break;
      default:
        // Fallback to white noise if type not recognized
        generateWhiteNoise(leftChannel, rightChannel);
        break;
    }
  } catch (error) {
    console.error("Error generating noise:", error);
    // Always fallback to white noise if any error occurs
    generateWhiteNoise(leftChannel, rightChannel);
  }
  
  // Apply fade in/out to prevent clicks
  applyFadeInOut(leftChannel, ctx.sampleRate);
  applyFadeInOut(rightChannel, ctx.sampleRate);
  
  try {
    // Create source and processing nodes
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    // Create gain control
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.7; // Reduce default volume to prevent clipping
    
    // Create compressor for better dynamics
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.05;
    
    // Connect nodes: source -> gain -> compressor -> destination
    source.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(ctx.destination);
    
    return { noiseSource: source, noiseGain: gainNode };
  } catch (error) {
    console.error("Error creating audio processing chain:", error);
    
    // Fallback to a simpler configuration if the full chain fails
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.5;
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      return { noiseSource: source, noiseGain: gainNode };
    } catch (finalError) {
      console.error("Critical audio error:", finalError);
      throw new Error("Unable to create audio");
    }
  }
}

/**
 * Modern AudioWorklet-based approach (uses async/await)
 */
async function createAudioWorkletNoise(ctx: AudioContext, noiseType: string) {
  try {
    // Check if already registered
    const isWorkletRegistered = (ctx as any)._noiseWorkletRegistered;
    
    if (!isWorkletRegistered) {
      // Create processor code as blob
      const processorCode = `
        class NoiseProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.noiseType = "${noiseType}";
            
            // State for various noise types
            this.brownLastL = 0;
            this.brownLastR = 0;
            this.lastOutputL = 0;
            this.lastOutputR = 0;
            this.b0 = 0;
            this.b1 = 0;
            this.b2 = 0;
            this.b3 = 0;
            this.b4 = 0;
            this.b5 = 0;
            this.b6 = 0;
            
            // Pink noise coefficients
            this.pinkCoeffs = {
              b0L: 0, b1L: 0, b2L: 0, b3L: 0, b4L: 0, b5L: 0,
              b0R: 0, b1R: 0, b2R: 0, b3R: 0, b4R: 0, b5R: 0
            };
          }
        
          process(inputs, outputs) {
            const output = outputs[0];
            const leftChannel = output[0];
            const rightChannel = output[1];
            
            for (let i = 0; i < leftChannel.length; i++) {
              // Generate white noise base
              const whiteNoiseL = Math.random() * 2 - 1;
              const whiteNoiseR = Math.random() * 2 - 1;
              
              let outputL, outputR;
              
              switch (this.noiseType) {
                case "pink":
                  // Pink noise using Paul Kellet's refined method
                  this.pinkCoeffs.b0L = 0.99886 * this.pinkCoeffs.b0L + whiteNoiseL * 0.0555179;
                  this.pinkCoeffs.b1L = 0.99332 * this.pinkCoeffs.b1L + whiteNoiseL * 0.0750759;
                  this.pinkCoeffs.b2L = 0.96900 * this.pinkCoeffs.b2L + whiteNoiseL * 0.1538520;
                  this.pinkCoeffs.b3L = 0.86650 * this.pinkCoeffs.b3L + whiteNoiseL * 0.3104856;
                  this.pinkCoeffs.b4L = 0.55000 * this.pinkCoeffs.b4L + whiteNoiseL * 0.5329522;
                  this.pinkCoeffs.b5L = -0.7616 * this.pinkCoeffs.b5L - whiteNoiseL * 0.0168980;
                  outputL = (this.pinkCoeffs.b0L + this.pinkCoeffs.b1L + this.pinkCoeffs.b2L + 
                             this.pinkCoeffs.b3L + this.pinkCoeffs.b4L + this.pinkCoeffs.b5L + 
                             whiteNoiseL * 0.5362) * 0.11;
                  
                  this.pinkCoeffs.b0R = 0.99886 * this.pinkCoeffs.b0R + whiteNoiseR * 0.0555179;
                  this.pinkCoeffs.b1R = 0.99332 * this.pinkCoeffs.b1R + whiteNoiseR * 0.0750759;
                  this.pinkCoeffs.b2R = 0.96900 * this.pinkCoeffs.b2R + whiteNoiseR * 0.1538520;
                  this.pinkCoeffs.b3R = 0.86650 * this.pinkCoeffs.b3R + whiteNoiseR * 0.3104856;
                  this.pinkCoeffs.b4R = 0.55000 * this.pinkCoeffs.b4R + whiteNoiseR * 0.5329522;
                  this.pinkCoeffs.b5R = -0.7616 * this.pinkCoeffs.b5R - whiteNoiseR * 0.0168980;
                  outputR = (this.pinkCoeffs.b0R + this.pinkCoeffs.b1R + this.pinkCoeffs.b2R + 
                             this.pinkCoeffs.b3R + this.pinkCoeffs.b4R + this.pinkCoeffs.b5R + 
                             whiteNoiseR * 0.5362) * 0.11;
                  break;
                  
                case "brown":
                  // High-quality brown noise
                  this.brownLastL = (0.97 * this.brownLastL) + (0.03 * whiteNoiseL);
                  this.brownLastR = (0.97 * this.brownLastR) + (0.03 * whiteNoiseR);
                  outputL = this.brownLastL * 3.5;
                  outputR = this.brownLastR * 3.5;
                  break;
                  
                case "blue":
                  // Blue noise - first-order high-pass
                  outputL = whiteNoiseL - this.lastOutputL;
                  outputR = whiteNoiseR - this.lastOutputR;
                  this.lastOutputL = whiteNoiseL;
                  this.lastOutputR = whiteNoiseR;
                  outputL *= 0.5;
                  outputR *= 0.5;
                  break;
                  
                case "violet":
                  // Violet noise - second-order high-pass
                  const tempL = whiteNoiseL - this.lastOutputL;
                  const tempR = whiteNoiseR - this.lastOutputR;
                  outputL = tempL - this.b0;
                  outputR = tempR - this.b1;
                  this.b0 = tempL;
                  this.b1 = tempR;
                  outputL *= 0.25;
                  outputR *= 0.25;
                  break;
                  
                case "green":
                  // Green noise - mid-emphasis filter
                  const x0L = whiteNoiseL;
                  const x0R = whiteNoiseR;
                  outputL = 0.30 * x0L + 0.40 * this.b2 - 0.70 * this.b4;
                  outputR = 0.30 * x0R + 0.40 * this.b3 - 0.70 * this.b5;
                  this.b4 = this.b2;
                  this.b5 = this.b3;
                  this.b2 = x0L;
                  this.b3 = x0R;
                  outputL *= 2.0;
                  outputR *= 2.0;
                  break;
                  
                case "gray":
                  // Gray noise - perceptual equalization
                  const input = whiteNoiseL;
                  outputL = 0.50 * input + 0.25 * this.b6 - 0.10 * this.lastOutputL;
                  outputR = 0.50 * whiteNoiseR + 0.25 * this.b6 - 0.10 * this.lastOutputR;
                  this.b6 = input;
                  this.lastOutputL = outputL;
                  this.lastOutputR = outputR;
                  outputL *= 1.8;
                  outputR *= 1.8;
                  break;
                  
                default:
                  // White noise 
                  outputL = whiteNoiseL;
                  outputR = whiteNoiseR;
              }
              
              // Soft-clipping to prevent digital distortion
              leftChannel[i] = Math.tanh(outputL);
              rightChannel[i] = Math.tanh(outputR);
            }
            return true;
          }
        }
        
        registerProcessor('noise-processor', NoiseProcessor);
      `;
      
      const blob = new Blob([processorCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      
      // Register the processor
      await ctx.audioWorklet.addModule(url);
      
      // Mark as registered
      (ctx as any)._noiseWorkletRegistered = true;
      
      // Clean up
      URL.revokeObjectURL(url);
    }
    
    // Create the node
    // @ts-ignore - TypeScript might not know about AudioWorkletNode
    const workletNode = new AudioWorkletNode(ctx, 'noise-processor', {
      outputChannelCount: [2]
    });
    
    // Set parameters if needed
    // workletNode.parameters.get('paramName').value = someValue;
    
    // Create gain node for volume control
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, ctx.currentTime);
    
    // Create compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.05;
    
    // Connect
    workletNode.connect(noiseGain);
    noiseGain.connect(compressor);
    compressor.connect(ctx.destination);
    
    console.log("Successfully created AudioWorklet for noise generation");
    
    return { noiseSource: workletNode, noiseGain };
  } catch (e) {
    console.error("AudioWorklet initialization failed:", e);
    // Fallback to buffer-based approach
    return createBufferNoise(ctx, noiseType);
  }
}

// Helper functions for noise generation
function generateWhiteNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  for (let i = 0; i < leftChannel.length; i++) {
    leftChannel[i] = Math.random() * 2 - 1;
    rightChannel[i] = Math.random() * 2 - 1;
  }
}

function generatePinkNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  // Simpler pink noise algorithm that's more stable
  let b0Left = 0, b1Left = 0, b2Left = 0;
  let b0Right = 0, b1Right = 0, b2Right = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    const white1 = Math.random() * 2 - 1;
    const white2 = Math.random() * 2 - 1;
    
    // Simple 3-pole pink noise filter
    b0Left = 0.99765 * b0Left + white1 * 0.0990460;
    b1Left = 0.96300 * b1Left + white1 * 0.2965164;
    b2Left = 0.57000 * b2Left + white1 * 1.0526913;
    
    b0Right = 0.99765 * b0Right + white2 * 0.0990460;
    b1Right = 0.96300 * b1Right + white2 * 0.2965164;
    b2Right = 0.57000 * b2Right + white2 * 1.0526913;
    
    // Scale down to avoid clipping
    leftChannel[i] = (b0Left + b1Left + b2Left) * 0.05;
    rightChannel[i] = (b0Right + b1Right + b2Right) * 0.05;
  }
}

function generateBrownNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  let lastLeft = 0;
  let lastRight = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    // Brown noise is an integration of white noise
    const whiteLeft = Math.random() * 2 - 1;
    const whiteRight = Math.random() * 2 - 1;
    
    // Lower factor for more stable algorithm
    lastLeft = (lastLeft + 0.015 * whiteLeft) / 1.015;
    lastRight = (lastRight + 0.015 * whiteRight) / 1.015;
    
    // Apply gain to bring to reasonable amplitude
    leftChannel[i] = lastLeft * 3.0;
    rightChannel[i] = lastRight * 3.0;
  }
}

function generateBlueNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  let lastLeft = 0;
  let lastRight = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    const whiteLeft = Math.random() * 2 - 1;
    const whiteRight = Math.random() * 2 - 1;
    
    // Blue noise - simple first-order differentiator
    const diffLeft = whiteLeft - lastLeft;
    const diffRight = whiteRight - lastRight;
    
    leftChannel[i] = diffLeft * 0.25; // Scale down to avoid harshness
    rightChannel[i] = diffRight * 0.25;
    
    lastLeft = whiteLeft;
    lastRight = whiteRight;
  }
}

function generateVioletNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  // For violet noise, we use the second derivative of white noise
  let prevLeft = 0, prevPrevLeft = 0;
  let prevRight = 0, prevPrevRight = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    const whiteLeft = Math.random() * 2 - 1;
    const whiteRight = Math.random() * 2 - 1;
    
    // Second-order difference equation
    const violetLeft = whiteLeft - 2 * prevLeft + prevPrevLeft;
    const violetRight = whiteRight - 2 * prevRight + prevPrevRight;
    
    // Update history
    prevPrevLeft = prevLeft;
    prevLeft = whiteLeft;
    prevPrevRight = prevRight;
    prevRight = whiteRight;
    
    // Scale down the output (violet noise has high energy)
    leftChannel[i] = violetLeft * 0.05;
    rightChannel[i] = violetRight * 0.05;
  }
}

function generateGreenNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  // Green noise - bandpass filtered white noise (midrange frequencies)
  // We'll simulate with a simple filter
  const bufferLength = leftChannel.length;
  
  // Generate white noise first
  const whiteNoiseLeft = new Float32Array(bufferLength);
  const whiteNoiseRight = new Float32Array(bufferLength);
  
  for (let i = 0; i < bufferLength; i++) {
    whiteNoiseLeft[i] = Math.random() * 2 - 1;
    whiteNoiseRight[i] = Math.random() * 2 - 1;
  }
  
  // Apply a simple midrange emphasis filter (basic bandpass)
  let a1 = 0.8, a2 = -0.8;
  let b0 = 0.5, b1 = 0, b2 = -0.5;
  
  // Filter history
  let x1L = 0, x2L = 0, y1L = 0, y2L = 0;
  let x1R = 0, x2R = 0, y1R = 0, y2R = 0;
  
  for (let i = 0; i < bufferLength; i++) {
    // Left channel
    const xL = whiteNoiseLeft[i];
    const yL = b0*xL + b1*x1L + b2*x2L - a1*y1L - a2*y2L;
    
    // Update history
    x2L = x1L; x1L = xL;
    y2L = y1L; y1L = yL;
    
    // Right channel
    const xR = whiteNoiseRight[i];
    const yR = b0*xR + b1*x1R + b2*x2R - a1*y1R - a2*y2R;
    
    // Update history
    x2R = x1R; x1R = xR;
    y2R = y1R; y1R = yR;
    
    // Write filtered output
    leftChannel[i] = yL * 1.5; // Boost gain a bit
    rightChannel[i] = yR * 1.5;
  }
}

function generateGrayNoise(leftChannel: Float32Array, rightChannel: Float32Array) {
  // Gray noise - noise shaped to match human hearing curves
  // We'll use a psychoacoustic approximation
  
  // First create white noise
  for (let i = 0; i < leftChannel.length; i++) {
    leftChannel[i] = Math.random() * 2 - 1;
    rightChannel[i] = Math.random() * 2 - 1;
  }
  
  // Then apply a filter that approximates equal loudness contours
  // Simple IIR filter coefficients
  const a1 = -1.8;
  const a2 = 0.85;
  const b0 = 0.1;
  const b1 = 0.2;
  const b2 = 0.1;
  
  // Filter states
  let x1L = 0, x2L = 0, y1L = 0, y2L = 0;
  let x1R = 0, x2R = 0, y1R = 0, y2R = 0;
  
  // Create a temporary array to avoid overwriting our input while filtering
  const tempLeft = new Float32Array(leftChannel.length);
  const tempRight = new Float32Array(rightChannel.length);
  
  // Copy input to temp arrays
  tempLeft.set(leftChannel);
  tempRight.set(rightChannel);
  
  // Apply filter
  for (let i = 0; i < leftChannel.length; i++) {
    // Left channel
    const xL = tempLeft[i];
    const yL = b0*xL + b1*x1L + b2*x2L - a1*y1L - a2*y2L;
    
    // Update history
    x2L = x1L; x1L = xL;
    y2L = y1L; y1L = yL;
    
    // Right channel
    const xR = tempRight[i];
    const yR = b0*xR + b1*x1R + b2*x2R - a1*y1R - a2*y2R;
    
    // Update history
    x2R = x1R; x1R = xR;
    y2R = y1R; y1R = yR;
    
    // Write filtered output
    leftChannel[i] = yL * 2.0; // Boost gain
    rightChannel[i] = yR * 2.0;
  }
}

function generateRainSound(leftChannel: Float32Array, rightChannel: Float32Array, sampleRate: number) {
  // Rain sound is a mix of filtered noise with occasional droplet sounds
  
  // Start with brown noise as background
  generateBrownNoise(leftChannel, rightChannel);
  
  // Scale down brown noise to leave room for droplets
  for (let i = 0; i < leftChannel.length; i++) {
    leftChannel[i] *= 0.3;
    rightChannel[i] *= 0.3;
  }
  
  // Add water droplet sounds at random intervals
  const dropFrequency = 0.01; // Probability of a drop starting in a given sample
  const dropLength = Math.floor(sampleRate * 0.04); // 40ms droplet sound
  
  for (let i = 0; i < leftChannel.length - dropLength; i++) {
    if (Math.random() < dropFrequency) {
      // Create a droplet sound
      addDroplet(leftChannel, rightChannel, i, dropLength, Math.random() * 0.4 + 0.1);
      // Skip ahead to avoid overlapping droplets
      i += Math.floor(dropLength * 0.5);
    }
  }
}

// Helper function to add a water droplet sound at a specific position
function addDroplet(leftChannel: Float32Array, rightChannel: Float32Array, startIdx: number, length: number, volume: number) {
  // Stereo positioning
  const panPosition = Math.random(); // 0 = left, 1 = right
  const leftGain = Math.sqrt(1 - panPosition) * volume;
  const rightGain = Math.sqrt(panPosition) * volume;
  
  // Droplet envelope (attack and decay)
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    // Envelope shape - quick attack, longer decay
    const envelope = (1 - progress) * Math.exp(-progress * 5);
    // Frequency sweep (starts high, drops lower)
    const frequency = 1500 - progress * 1000;
    // Oscillator
    const oscillation = Math.sin(frequency * i / 1000);
    
    // Apply envelope and stereo panning
    if (startIdx + i < leftChannel.length) {
      leftChannel[startIdx + i] += oscillation * envelope * leftGain;
      rightChannel[startIdx + i] += oscillation * envelope * rightGain;
    }
  }
}

// ----------- TIME PRESETS -------------
const TIME_PRESETS = [
  { label: "15m", duration: 15 * 60, default: true },
  { label: "30m", duration: 30 * 60 },
  { label: "60m", duration: 60 * 60 },
  { label: "90m", duration: 90 * 60 },
];

type AudioMode = "binaural" | "noise" | "om";

type NoiseType =
  | "white"
  | "pink"
  | "brown"
  | "green"
  | "blue"
  | "violet"
  | "gray"
  | "rain";

const NOISE_TYPES = {
  white: "White Noise",
  pink: "Pink Noise",
  brown: "Brown Noise",
  green: "Green Noise",
  blue: "Blue Noise",
  violet: "Violet Noise",
  gray: "Gray Noise",
  rain: "Rain Sound",
};

// ------------------------------------------------------------------------------------
//   MAIN COMPONENT
// ------------------------------------------------------------------------------------
export default function BinauralBeatExperience() {
  // ---- State management ----
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatFrequency, setBeatFrequency] = useState(10);
  const [isMuted, setIsMuted] = useState(false);
  const [currentPreset, setCurrentPreset] = useState("Custom");
  const [timer, setTimer] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(15 * 60);
  const [customDuration, setCustomDuration] = useState(15 * 60);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("binaural");
  const [noiseType, setNoiseType] = useState<NoiseType>("white");
  const [isBackgroundPlaying, setIsBackgroundPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [omBuffer, setOmBuffer] = useState<AudioBuffer | null>(null);

  // ---- Audio nodes ----
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorLeftRef = useRef<OscillatorNode | null>(null);
  const oscillatorRightRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Allow for either AudioBufferSourceNode, ScriptProcessorNode, or AudioWorkletNode
  const noiseSourceRef = useRef<AudioNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  // ---- Timer & background context ----
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundAudioContextRef = useRef<AudioContext | null>(null);

  // ---- Dark mode theming from next-themes (optional) ----
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // ---- Canvas and animation refs ----
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ---- Lifecycle: set up media session for lockscreen controls, cleanup ----
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("mediaSession" in navigator) {
        // Attempt to handle play/pause from OS
        navigator.mediaSession.setActionHandler("play", () => startAudio());
        navigator.mediaSession.setActionHandler("pause", () => stopAudio());
        navigator.mediaSession.setActionHandler("stop", () => stopAudio());
      }

      // Cleanup on unmount
      return () => {
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, []);

  // --------------------------------------------------------------------------------
  //   START AUDIO
  // --------------------------------------------------------------------------------
  const startAudio = async () => {
    if (typeof window === "undefined") return;

    // Create or resume AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Kill any "background" audio if it's playing
    if (isBackgroundPlaying) {
      setIsBackgroundPlaying(false);
      if (backgroundAudioContextRef.current) {
        backgroundAudioContextRef.current.close();
        backgroundAudioContextRef.current = null;
      }
    }

    // Set lockscreen metadata
    if ("mediaSession" in navigator) {
      (navigator as any).mediaSession.metadata = new MediaMetadata({
        title: "Binaural Beats",
        artist: "Focus Work",
        album:
          audioMode === "binaural"
            ? `${getBeatCategory(beatFrequency)} - ${beatFrequency}Hz`
            : audioMode === "noise"
            ? NOISE_TYPES[noiseType]
            : "OM Sound",
      });
    }

    // Handle different audio modes
    switch (audioMode) {
      case "binaural":
        if (!oscillatorLeftRef.current || !oscillatorRightRef.current) {
          // Create main oscillators with smoother waveform (sine)
          oscillatorLeftRef.current = ctx.createOscillator();
          oscillatorRightRef.current = ctx.createOscillator();
          
          // Set oscillator type to sine for clean tones
          oscillatorLeftRef.current.type = 'sine';
          oscillatorRightRef.current.type = 'sine';
          
          // Create individual gain nodes for each ear for better control
          const leftGain = ctx.createGain();
          const rightGain = ctx.createGain();
          leftGain.gain.value = 0.8; // Slightly reduce volume to prevent distortion
          rightGain.gain.value = 0.8;
          
          // Create main gain node and analyzer
          gainNodeRef.current = ctx.createGain();
          analyserRef.current = ctx.createAnalyser();
          
          // Set up analyzer for better visualization
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.85;

          // This is the "carrier frequency" - using a better range for headphones
          const fixedBaseFrequency = 250; // Slightly higher baseFrequency for clearer sound
          
          // Add a tiny ramp time to prevent clicks when starting
          oscillatorLeftRef.current.frequency.setValueAtTime(
            fixedBaseFrequency,
            ctx.currentTime
          );
          oscillatorRightRef.current.frequency.setValueAtTime(
            fixedBaseFrequency + beatFrequency,
            ctx.currentTime
          );

          // Create compressor to prevent distortion
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -24;
          compressor.knee.value = 30;
          compressor.ratio.value = 12;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;
          
          // Apply low-pass filter to smooth out high frequencies
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 2000;
          filter.Q.value = 0.5;

          // Merge them into L and R channels
          const merger = ctx.createChannelMerger(2);
          
          // Left channel connection
          oscillatorLeftRef.current.connect(leftGain);
          leftGain.connect(merger, 0, 0);
          
          // Right channel connection
          oscillatorRightRef.current.connect(rightGain);
          rightGain.connect(merger, 0, 1);

          // Connect to processing chain: merger -> gain -> compressor -> filter -> analyser -> destination
          merger.connect(gainNodeRef.current);
          gainNodeRef.current.connect(compressor);
          compressor.connect(filter);
          filter.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);

          // Start oscillators with safety checks
          try {
            oscillatorLeftRef.current.start();
            oscillatorRightRef.current.start();
          } catch (e) {
            console.error("Error starting oscillators:", e);
            // Fallback - recreate and retry once
            try {
              oscillatorLeftRef.current = ctx.createOscillator();
              oscillatorRightRef.current = ctx.createOscillator();
              oscillatorLeftRef.current.type = 'sine';
              oscillatorRightRef.current.type = 'sine';
              oscillatorLeftRef.current.frequency.value = fixedBaseFrequency;
              oscillatorRightRef.current.frequency.value = fixedBaseFrequency + beatFrequency;
              oscillatorLeftRef.current.connect(leftGain);
              oscillatorRightRef.current.connect(rightGain);
              oscillatorLeftRef.current.start();
              oscillatorRightRef.current.start();
            } catch (e2) {
              console.error("Fatal error starting audio:", e2);
            }
          }
        }
        break;
      case "noise":
        try {
          // Clean up any existing noise source
          if (noiseSourceRef.current) {
            try {
              // Handle different node types - ScriptProcessorNode and AudioWorkletNode
              // don't have stop() methods, only AudioBufferSourceNode does
              if ('stop' in noiseSourceRef.current && typeof noiseSourceRef.current.stop === 'function') {
                (noiseSourceRef.current as AudioBufferSourceNode).stop();
              }
              noiseSourceRef.current.disconnect();
            } catch (e) {
              console.log("Error stopping previous noise source:", e);
            }
            noiseSourceRef.current = null;
          }
          
          if (noiseGainRef.current) {
            try {
              noiseGainRef.current.disconnect();
            } catch (e) {
              console.log("Error disconnecting previous gain node:", e);
            }
            noiseGainRef.current = null;
          }

          // Create fresh noise generator with current noise type
          console.log("Creating new noise generator with type:", noiseType);
          const noiseResult = createNoise(ctx, noiseType);
          
          // Function to handle noise setup
          const setupNoise = async (result: { noiseSource: AudioNode; noiseGain: GainNode }) => {
            // Store references to the new nodes
            noiseSourceRef.current = result.noiseSource;
            noiseGainRef.current = result.noiseGain;
            
            // Connect to analyzer if it exists
            if (analyserRef.current) {
              result.noiseGain.connect(analyserRef.current);
            }
            
            // Start the noise source if it has a start method
            if ('start' in result.noiseSource && typeof result.noiseSource.start === 'function') {
              (result.noiseSource as AudioBufferSourceNode).start();
            }
          };
          
          // Handle both promise and direct return
          if (noiseResult instanceof Promise) {
            noiseResult.then(setupNoise).catch(error => {
              console.error("Error setting up noise:", error);
            });
          } else {
            setupNoise(noiseResult);
          }
          
          // Create analyzer node for visualization if not exists
          if (!analyserRef.current) {
            analyserRef.current = ctx.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0.85;
            
            // Connect analyzer to destination for monitoring
            analyserRef.current.connect(ctx.destination);
          }
          
          // Connect the noise gain to the analyzer for visualization in the setupNoise function
          // We move these operations into the setupNoise function to ensure we have access to the nodes

          // The start of the noise source is now handled in the setupNoise function
          console.log("Noise source started successfully");
        } catch (error) {
          console.error("Error setting up noise:", error);
          // Try to recover with a fallback to white noise
          try {
            const buffer = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
            const leftChannel = buffer.getChannelData(0);
            const rightChannel = buffer.getChannelData(1);
            
            // Simple white noise fallback
            for (let i = 0; i < buffer.length; i++) {
              leftChannel[i] = Math.random() * 2 - 1;
              rightChannel[i] = Math.random() * 2 - 1;
            }
            
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            
            const gainNode = ctx.createGain();
            gainNode.gain.value = 0.5;
            
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            noiseSourceRef.current = source;
            noiseGainRef.current = gainNode;
            
            source.start();
            console.log("Fallback white noise started");
          } catch (finalError) {
            console.error("Critical failure in noise generation:", finalError);
          }
        }
        break;
      case "om":
        try {
          // Create simple audio path
          console.log("Starting OM sound...");
          
          // Create gain node for volume control
          gainNodeRef.current = ctx.createGain();
          gainNodeRef.current.gain.value = 0.7; // Lower gain to avoid distortion
          
          // Create basic analyzer for visualization
          analyserRef.current = ctx.createAnalyser();
          analyserRef.current.fftSize = 1024; // Lower for better performance
          
          // Connect nodes
          gainNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
          
          // Generate or use cached OM buffer
          if (!omBuffer) {
            // Create a simple OM sound - basic for reliability
            const omDuration = 8.0; // fixed duration for looping
            const omFreq = 136.0; // Standard OM frequency in Hz
            
            const newBuffer = createOmSound(
              ctx,
              omDuration,
              omFreq,
              'normal',
              ctx.sampleRate
            );
            
            setOmBuffer(newBuffer);
            console.log("OM buffer created successfully");
          }
          
          // Create and connect the buffer source
          const source = ctx.createBufferSource();
          source.buffer = omBuffer || createOmSound(ctx, 8.0, 136.0);
          source.connect(gainNodeRef.current);
          
          // Enable looping
          source.loop = true;
          
          // Start playback
          source.start(0);
          console.log("OM sound started");
          
        } catch (error) {
          console.error("Error with OM sound:", error);
          
          // Super simple fallback
          try {
            const osc = ctx.createOscillator();
            osc.frequency.value = 136;
            osc.type = 'sine';
            
            gainNodeRef.current = ctx.createGain();
            gainNodeRef.current.gain.value = 0.5;
            
            osc.connect(gainNodeRef.current);
            gainNodeRef.current.connect(ctx.destination);
            
            osc.start();
            console.log("Simple fallback OM tone started");
          } catch (e) {
            console.error("Critical OM fallback error:", e);
          }
        }
        break;
    }

    updateVolume();
    setIsPlaying(true);
    setIsTransitioning(true);
    startTimer();

    // Trigger the transition animation (burst effect in canvas)
    setIsTransitioning(true);
    requestAnimationFrame(() => setIsTransitioning(false));
  };

  // --------------------------------------------------------------------------------
  //   STOP AUDIO
  // --------------------------------------------------------------------------------
  const stopAudio = () => {
    // Stop all audio cleanly
    try {
      // We'll handle all nodes directly rather than tracking them in an array
      
      // Properly disconnect and stop all audio nodes
      if (oscillatorLeftRef.current) {
        oscillatorLeftRef.current.stop();
        oscillatorLeftRef.current.disconnect();
      }
      
      if (oscillatorRightRef.current) {
        oscillatorRightRef.current.stop();
        oscillatorRightRef.current.disconnect();
      }
      
      if (noiseSourceRef.current) {
        // Handle different types of audio nodes - AudioWorkletNode or ScriptProcessorNode 
        // may not have a stop() method, only AudioBufferSourceNode does
        if ('stop' in noiseSourceRef.current && typeof noiseSourceRef.current.stop === 'function') {
          (noiseSourceRef.current as AudioBufferSourceNode).stop();
        }
        noiseSourceRef.current.disconnect();
      }
      
      // Find and collect any OM buffer source nodes
      if (audioMode === "om" && audioContextRef.current) {
        // There is no direct reference to the OM source node in this code
        // This is a best-effort to stop all buffer source nodes that might be playing
        const ctx = audioContextRef.current;
        
        // We will use a gentle fade-out instead of abrupt stop
        if (gainNodeRef.current) {
          const now = ctx.currentTime;
          // Start from current gain
          gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
          // Fade out over 100ms
          gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.1);
        }
      }
      
      // Disconnect gain nodes
      if (gainNodeRef.current) {
        setTimeout(() => {
          if (gainNodeRef.current) {
            gainNodeRef.current.disconnect();
          }
        }, 110); // Wait for fade-out before disconnecting
      }
      
      if (noiseGainRef.current) {
        noiseGainRef.current.disconnect();
      }
      
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      
      // Wait briefly for fade out, then clean up context
      setTimeout(() => {
        if (audioContextRef.current) {
          // Suspend rather than close to allow for faster restart
          audioContextRef.current.suspend().then(() => {
            // Reset all refs after context is suspended
            oscillatorLeftRef.current = null;
            oscillatorRightRef.current = null;
            gainNodeRef.current = null;
            analyserRef.current = null;
            noiseSourceRef.current = null;
            noiseGainRef.current = null;
            
            // Don't clear the omBuffer - we want to reuse it
            // But if we've stopped due to an error, clear it for a fresh start next time
            if (audioMode !== "om") {
              setOmBuffer(null);
            }
          });
        }
      }, 120); // 120ms delay for clean fade out
    } catch (err) {
      console.error("Error stopping audio:", err);
      // In case of error, force clear all refs
      oscillatorLeftRef.current = null;
      oscillatorRightRef.current = null;
      gainNodeRef.current = null;
      analyserRef.current = null;
      noiseSourceRef.current = null;
      noiseGainRef.current = null;
      
      // Reset OM buffer on error for a fresh start
      setOmBuffer(null);
    }
    
    setIsPlaying(false);
    stopTimer();
  };

  // --------------------------------------------------------------------------------
  //   UPDATE FREQUENCY (For Binaural Beats) with Smooth Transitions
  // --------------------------------------------------------------------------------
  const updateFrequency = () => {
    if (
      audioMode === "binaural" &&
      oscillatorLeftRef.current &&
      oscillatorRightRef.current &&
      audioContextRef.current
    ) {
      const ctx = audioContextRef.current;
      const carrierFrequency = 250; // Fixed carrier frequency for optimal binaural effect
      const now = ctx.currentTime;
      
      // Use proper binaural beat method: carrier ± beat/2
      // This creates the correct beating effect between the ears
      const leftFreq = carrierFrequency - (beatFrequency / 2);
      const rightFreq = carrierFrequency + (beatFrequency / 2);
      
      // Use smooth transitions to prevent audio artifacts
      oscillatorLeftRef.current.frequency.setTargetAtTime(
        leftFreq, 
        now,
        0.05 // Time constant for smooth transition
      );
      
      oscillatorRightRef.current.frequency.setTargetAtTime(
        rightFreq,
        now,
        0.05
      );
      
      // Phase correction if frequencies drift too far
      const leftCurrentFreq = oscillatorLeftRef.current.frequency.value;
      const rightCurrentFreq = oscillatorRightRef.current.frequency.value;
      
      if (Math.abs(leftCurrentFreq - leftFreq) > 1 || Math.abs(rightCurrentFreq - rightFreq) > 1) {
        // Cancel any pending changes and correct immediately
        oscillatorLeftRef.current.frequency.cancelScheduledValues(now);
        oscillatorRightRef.current.frequency.cancelScheduledValues(now);
        
        oscillatorLeftRef.current.frequency.setTargetAtTime(leftFreq, now, 0.01);
        oscillatorRightRef.current.frequency.setTargetAtTime(rightFreq, now, 0.01);
        
        console.log(`Frequency correction applied: L:${leftFreq}Hz, R:${rightFreq}Hz (beat: ${beatFrequency}Hz)`);
      }
    }
  };

  // --------------------------------------------------------------------------------
  //   UPDATE VOLUME (Mute / Unmute)
  // --------------------------------------------------------------------------------
  const updateVolume = () => {
    if (gainNodeRef.current && audioContextRef.current) {
      const volume = isPlaying ? (isMuted ? 0 : 1) : 0;
      gainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }
  };

  // Re-apply volume on mute/unmute changes
  useEffect(() => {
    if (isPlaying) {
      updateVolume();
    }
  }, [isMuted, isPlaying]);

  // Mute toggle
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (isPlaying) {
      updateVolume();
    }
  };

  const getBeatCategory = (freq: number) => {
    if (freq <= 4) return "Delta";
    if (freq <= 8) return "Theta";
    if (freq <= 13) return "Alpha";
    return "Beta";
  };

  // --------------------------------------------------------------------------------
  //   SESSION TIMER
  // --------------------------------------------------------------------------------
  const startTimer = () => {
    if (selectedDuration === 0) {
      setSelectedDuration(15 * 60);
    }
    timerIntervalRef.current = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer >= selectedDuration - 1) {
          // Auto-stop when the timer hits the preset
          stopAudio();
          return selectedDuration;
        }
        return prevTimer + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  // --------------------------------------------------------------------------------
  //   DURATION HANDLERS
  // --------------------------------------------------------------------------------
  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setTimer(0);
    setIsCustomDuration(false);
    if (selectedDuration === 0) {
      const defaultPreset = TIME_PRESETS.find(preset => preset.default);
      if (defaultPreset) {
        setSelectedDuration(defaultPreset.duration);
      }
    }
  };

  const handleCustomDurationSelect = () => {
    setIsCustomDuration(true);
    setSelectedDuration(customDuration);
    setTimer(0);
  };

  const handleCustomDurationChange = (value: number[]) => {
    const duration = value[0] * 60;
    setCustomDuration(duration);
    setSelectedDuration(duration);
    setTimer(0);
  };

  // --------------------------------------------------------------------------------
  //   SWITCH AUDIO MODE
  // --------------------------------------------------------------------------------
  const handleAudioModeChange = (newMode: AudioMode) => {
    if (isPlaying) {
      stopAudio();
    }
    setAudioMode(newMode);
  };

  // --------------------------------------------------------------------------------
  //   SWITCH NOISE TYPE - with improved stability
  // --------------------------------------------------------------------------------
  const handleNoiseTypeChange = (value: NoiseType) => {
    console.log(`Switching noise type to: ${value}`);
    
    // First update the state with the new noise type
    setNoiseType(value);

    // If audio is playing, we need to restart with the new noise type
    if (isPlaying && audioMode === "noise") {
      try {
        // Use a gentler approach than full stop/start
        // First try to gracefully stop just the noise source
        if (noiseSourceRef.current) {
          try {
            // Fade out the current noise
            if (noiseGainRef.current && audioContextRef.current) {
              const now = audioContextRef.current.currentTime;
              noiseGainRef.current.gain.setValueAtTime(noiseGainRef.current.gain.value, now);
              noiseGainRef.current.gain.linearRampToValueAtTime(0, now + 0.1);
            }
            
            // Schedule cleanup after fade-out
            setTimeout(() => {
              try {
                if (noiseSourceRef.current) {
                  // Check if stop method exists
                  if ('stop' in noiseSourceRef.current && typeof noiseSourceRef.current.stop === 'function') {
                    (noiseSourceRef.current as AudioBufferSourceNode).stop();
                  }
                  noiseSourceRef.current.disconnect();
                  noiseSourceRef.current = null;
                }
                
                if (noiseGainRef.current) {
                  noiseGainRef.current.disconnect();
                  noiseGainRef.current = null;
                }
                
                // Now restart just the noise portion
                if (audioContextRef.current) {
                  const ctx = audioContextRef.current;
                  const noiseResult = createNoise(ctx, value);
                  
                  // Handle both synchronous and Promise-based results
                  const setupNoiseSource = (result: { noiseSource: AudioNode; noiseGain: GainNode }) => {
                    noiseSourceRef.current = result.noiseSource;
                    noiseGainRef.current = result.noiseGain;
                    
                    // Connect to analyzer for visualization if it exists
                    if (analyserRef.current) {
                      result.noiseGain.connect(analyserRef.current);
                    }
                    
                    // Start the new noise source if it has a start method
                    if ('start' in result.noiseSource && typeof result.noiseSource.start === 'function') {
                      (result.noiseSource as AudioBufferSourceNode).start();
                    }
                  };
                  
                  // Handle the result, which might be a Promise
                  if (noiseResult instanceof Promise) {
                    noiseResult.then(setupNoiseSource).catch(error => {
                      console.error("Error setting up noise source:", error);
                      stopAudio();
                    });
                  } else {
                    setupNoiseSource(noiseResult);
                  }
                  console.log("New noise source started successfully");
                }
              } catch (cleanupError) {
                console.error("Error during noise type switching cleanup:", cleanupError);
                // Full restart as fallback
                stopAudio();
                setTimeout(() => startAudio(), 100);
              }
            }, 100); // Short delay for the fade out
          } catch (e) {
            console.error("Error with graceful noise transition:", e);
            // Fall back to full stop/restart
            stopAudio();
            setTimeout(() => startAudio(), 200);
          }
        } else {
          // If no current noise source, just do a full restart
          stopAudio();
          setTimeout(() => startAudio(), 200);
        }
      } catch (error) {
        console.error("Error switching noise type:", error);
        // Final fallback - do a complete audio restart after a pause
        stopAudio();
        setTimeout(() => {
          if (audioMode === "noise") {
            startAudio();
          }
        }, 500);
      }
    }
    // If not playing, the new type will be used next time startAudio is called
  };

  // --------------------------------------------------------------------------------
  //   AUDIO QUALITY IMPROVEMENTS
  // --------------------------------------------------------------------------------
  
  // Handler for page visibility changes - ensure consistent audio
  const handleVisibilityChange = () => {
    if (typeof document === "undefined") return;
    
    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (!document.hidden && isPlaying) {
      // Tab became visible again - ensure audio context is running
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          console.log("Audio context resumed after tab switch");
          // Force frequency update after resume to maintain accuracy
          updateFrequency();
        });
      } else {
        // Context wasn't suspended, but still refresh frequencies to prevent drift
        setTimeout(() => {
          updateFrequency();
        }, 50); // Small delay to let browser settle
      }
    } else if (document.hidden && isPlaying) {
      // Tab is being hidden - try to keep audio context alive
      // Some browsers suspend context anyway, but we can try
      if (ctx.state === "running") {
        // Force a small audio operation to keep context active
        try {
          const now = ctx.currentTime;
          if (gainNodeRef.current) {
            // Create a tiny, imperceptible gain change to keep context alive
            gainNodeRef.current.gain.setValueAtTime(
              gainNodeRef.current.gain.value,
              now
            );
          }
        } catch (e) {
          console.log("Could not maintain audio context while tab hidden");
        }
      }
    }
  };

  // Use the Page Visibility API to keep audio consistent across tab switches
  useEffect(() => {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      // Add visibility change listener
      document.addEventListener("visibilitychange", handleVisibilityChange);
      
      // Add focus/blur events for additional stability
      window.addEventListener("focus", handleVisibilityChange);
      
      // Audio CPU budget optimization
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          if (audioContextRef.current && audioMode === "binaural") {
            updateFrequency();
          }
        });
      }
      
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleVisibilityChange);
      };
    }
  }, [isPlaying, beatFrequency, audioMode]);
  
  // Initialize audio worklet for better audio processing if supported
  useEffect(() => {
    if (typeof window !== "undefined" && window.AudioContext) {
      const setupAudioWorklet = async () => {
        // Only initialize if Web Audio API is fully supported
        try {
          const tempContext = new AudioContext();
          if (tempContext.audioWorklet) {
            console.log("Audio worklet supported - better audio quality available");
          }
          await tempContext.close();
        } catch (err) {
          console.log("Advanced audio features not available in this browser");
        }
      };
      
      setupAudioWorklet();
    }
  }, []);

  useEffect(() => {
    if (selectedDuration === 0) {
      const defaultPreset = TIME_PRESETS.find(preset => preset.default);
      if (defaultPreset) {
        setSelectedDuration(defaultPreset.duration);
      }
    }
  }, []);


  // --------------------------------------------------------------------------------
  //   ENHANCED AUDIO-REACTIVE CANVAS ANIMATION
  // --------------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 320 * dpr;
    canvas.height = 320 * dpr;
    canvas.style.width = "320px";
    canvas.style.height = "320px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const centerX = canvas.width / (2 * dpr);
    const centerY = canvas.height / (2 * dpr);

    interface Particle {
      x: number;
      y: number;
      radius: number;
      color: string;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      type: 'burst' | 'frequency' | 'ambient';
      frequency?: number;
    }

    const particles: Particle[] = [];
    const frequencyParticles: Particle[] = [];
    const ambientParticles: Particle[] = [];
    
    let burstCreated = false;
    let pulsePhase = 0;
    let frequencyVisualizationPhase = 0;
    let audioData: Uint8Array | null = null;

    // Get audio data for visualization
    const getAudioData = () => {
      if (analyserRef.current) {
        if (!audioData) {
          audioData = new Uint8Array(analyserRef.current.frequencyBinCount);
        }
        analyserRef.current.getByteFrequencyData(audioData);
        return audioData;
      }
      return null;
    };

    // Create burst particles with enhanced effects
    const createBurstParticles = () => {
      const particleCount = 80;
      particles.length = 0;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const speed = Math.random() * 3 + 1;
        const maxLife = Math.random() * 100 + 50;
        
        particles.push({
          x: centerX + (Math.random() - 0.5) * 20,
          y: centerY + (Math.random() - 0.5) * 20,
          radius: Math.random() * 3 + 1,
          color: getParticleColor(audioMode),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: maxLife,
          maxLife,
          type: 'burst'
        });
      }
    };

    // Create frequency-reactive particles
    const createFrequencyParticles = () => {
      const data = getAudioData();
      if (!data || !isPlaying) return;

      // Create particles based on frequency data
      for (let i = 0; i < Math.min(data.length, 32); i += 2) {
        const amplitude = data[i] / 255;
        if (amplitude > 0.1) {
          const angle = (i / 32) * Math.PI * 2;
          const distance = 50 + amplitude * 60;
          
          frequencyParticles.push({
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance,
            radius: amplitude * 4 + 1,
            color: getFrequencyColor(i, amplitude),
            vx: Math.cos(angle) * amplitude * 2,
            vy: Math.sin(angle) * amplitude * 2,
            life: 30,
            maxLife: 30,
            type: 'frequency',
            frequency: i
          });
        }
      }
    };

    // Create ambient floating particles
    const createAmbientParticles = () => {
      if (ambientParticles.length < 20 && Math.random() < 0.1) {
        ambientParticles.push({
          x: Math.random() * 320,
          y: Math.random() * 320,
          radius: Math.random() * 2 + 0.5,
          color: getAmbientColor(),
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          life: Math.random() * 200 + 100,
          maxLife: 300,
          type: 'ambient'
        });
      }
    };

    const getParticleColor = (mode: string) => {
      switch (mode) {
        case 'binaural':
          return `hsla(${220 + Math.random() * 40}, 70%, ${60 + Math.random() * 20}%, 0.8)`;
        case 'noise':
          return `hsla(${280 + Math.random() * 40}, 60%, ${50 + Math.random() * 30}%, 0.7)`;
        case 'om':
          return `hsla(${30 + Math.random() * 60}, 80%, ${70 + Math.random() * 20}%, 0.9)`;
        default:
          return `hsla(${Math.random() * 360}, 70%, 60%, 0.8)`;
      }
    };

    const getFrequencyColor = (frequency: number, amplitude: number) => {
      const hue = (frequency / 32) * 240 + 120; // Green to blue spectrum
      const saturation = 60 + amplitude * 40;
      const lightness = 50 + amplitude * 30;
      return `hsla(${hue}, ${saturation}%, ${lightness}%, ${amplitude * 0.8 + 0.2})`;
    };

    const getAmbientColor = () => {
      const hue = 200 + Math.random() * 160;
      return `hsla(${hue}, 40%, 60%, 0.3)`;
    };

    // Draw enhanced idle visualization
    const drawIdleVisualization = () => {
      pulsePhase += 0.03;
      const pulseRadius = 15 + Math.sin(pulsePhase) * 5;
      const secondaryRadius = 25 + Math.sin(pulsePhase * 1.3) * 3;

      // Primary circle with audio-reactive colors
      const primaryGradient = ctx.createRadialGradient(
        centerX, centerY, pulseRadius * 0.1,
        centerX, centerY, pulseRadius * 1.5
      );
      primaryGradient.addColorStop(0, getParticleColor(audioMode));
      primaryGradient.addColorStop(1, "rgba(0, 123, 255, 0.05)");

      ctx.shadowColor = getParticleColor(audioMode);
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = primaryGradient;
      ctx.fill();

      // Secondary ring
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, secondaryRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${(pulsePhase * 20) % 360}, 60%, 70%, 0.4)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowBlur = 0;
    };

    // Draw and update all particle systems
    const updateAndDrawParticles = () => {
      // Update burst particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vx *= 0.98; // Gentle deceleration
        p.vy *= 0.98;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.life / p.maxLife;
        const size = p.radius * alpha;
        
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // Update frequency particles
      for (let i = frequencyParticles.length - 1; i >= 0; i--) {
        const p = frequencyParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= 0) {
          frequencyParticles.splice(i, 1);
          continue;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // Update ambient particles
      for (let i = ambientParticles.length - 1; i >= 0; i--) {
        const p = ambientParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        // Gentle floating motion
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
        p.vx *= 0.95;
        p.vy *= 0.95;

        // Wrap around edges
        if (p.x < 0) p.x = 320;
        if (p.x > 320) p.x = 0;
        if (p.y < 0) p.y = 320;
        if (p.y > 320) p.y = 0;

        if (p.life <= 0) {
          ambientParticles.splice(i, 1);
          continue;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.6;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
    };

    // Draw audio-reactive central visualization
    const drawAudioReactiveCenter = () => {
      const data = getAudioData();
      if (!data) return;

      frequencyVisualizationPhase += 0.02;
      const avgAmplitude = data.reduce((sum, val) => sum + val, 0) / data.length / 255;
      
      // Central pulsing based on audio amplitude
      const reactiveRadius = 20 + avgAmplitude * 30;
      const centralGradient = ctx.createRadialGradient(
        centerX, centerY, reactiveRadius * 0.2,
        centerX, centerY, reactiveRadius * 1.3
      );
      
      const hue = (frequencyVisualizationPhase * 30 + avgAmplitude * 120) % 360;
      centralGradient.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.9)`);
      centralGradient.addColorStop(1, `hsla(${hue}, 60%, 40%, 0.1)`);

      ctx.shadowColor = `hsla(${hue}, 80%, 70%, 0.6)`;
      ctx.shadowBlur = 20 + avgAmplitude * 20;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, reactiveRadius, 0, Math.PI * 2);
      ctx.fillStyle = centralGradient;
      ctx.fill();

      ctx.shadowBlur = 0;

      // Frequency rings
      for (let i = 0; i < Math.min(data.length, 16); i++) {
        const amplitude = data[i] / 255;
        const angle = (i / 16) * Math.PI * 2 + frequencyVisualizationPhase;
        const radius = 60 + amplitude * 40;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.globalAlpha = amplitude * 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 2 + amplitude * 4, 0, Math.PI * 2);
        ctx.fillStyle = getFrequencyColor(i, amplitude);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1.0;
    };

    const animate = () => {
      // Clear with slight trail effect for smoother visuals
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, 320, 320);

      if (!isPlaying) {
        burstCreated = false;
        drawIdleVisualization();
        createAmbientParticles();
        updateAndDrawParticles();
      } else {
        if (!burstCreated) {
          createBurstParticles();
          burstCreated = true;
        }
        
        drawAudioReactiveCenter();
        createFrequencyParticles();
        createAmbientParticles();
        updateAndDrawParticles();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isTransitioning, audioMode, beatFrequency]);

  // Future ad integration can be added here if needed
  
  // Audio performance optimization
  useEffect(() => {
    // Apply beat frequency changes with additional smoothing
    if (audioMode === "binaural" && isPlaying) {
      updateFrequency();
    }
    
    // Monitor audio performance
    const checkPerformance = () => {
      if (audioContextRef.current && audioContextRef.current.state === "running") {
        const currentTime = audioContextRef.current.currentTime;
        // Store for debugging if needed
        // console.log("Audio context time:", currentTime);
      }
    };
    
    // Run performance check periodically
    const performanceInterval = setInterval(checkPerformance, 10000);
    
    return () => {
      clearInterval(performanceInterval);
    };
  }, [beatFrequency, audioMode, isPlaying]);

  // --------------------------------------------------------------------------------
  //   AWARD-WINNING IMMERSIVE RENDER
  // --------------------------------------------------------------------------------
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Dynamic Atmospheric Background */}
      <div className="absolute inset-0">
        {/* Base gradient that adapts to audio mode */}
        <div className={`absolute inset-0 transition-all duration-2000 ease-in-out ${
          audioMode === 'binaural' ? 'bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-purple-900/20' :
          audioMode === 'noise' ? 'bg-gradient-to-br from-gray-900/30 via-slate-800/20 to-gray-900/30' :
          'bg-gradient-to-br from-amber-900/20 via-orange-900/10 to-amber-900/20'
        }`} />
        
        {/* Animated mesh gradient */}
        <div className="absolute inset-0 opacity-30">
          <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-3000 ${
            audioMode === 'binaural' ? 'bg-blue-500/20 animate-pulse' :
            audioMode === 'noise' ? 'bg-slate-500/20 animate-bounce' :
            'bg-orange-500/20 animate-ping'
          }`} />
          <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl transition-all duration-3000 delay-1000 ${
            audioMode === 'binaural' ? 'bg-purple-500/20 animate-pulse' :
            audioMode === 'noise' ? 'bg-gray-500/20 animate-bounce' :
            'bg-amber-500/20 animate-ping'
          }`} />
          <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-3xl transition-all duration-3000 delay-2000 ${
            audioMode === 'binaural' ? 'bg-indigo-500/20 animate-pulse' :
            audioMode === 'noise' ? 'bg-zinc-500/20 animate-bounce' :
            'bg-yellow-500/20 animate-ping'
          }`} />
        </div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_70%)]" />
      </div>

      {/* Central Visualization Area */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        
        {/* Main Audio Visualization */}
        <div className="relative mb-16">
          {/* Outer glow ring */}
          <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
            isPlaying ? 'shadow-[0_0_100px_rgba(139,69,255,0.3)]' : 'shadow-[0_0_50px_rgba(139,69,255,0.1)]'
          } ${
            audioMode === 'binaural' ? 'shadow-purple-500/30' :
            audioMode === 'noise' ? 'shadow-slate-500/30' :
            'shadow-orange-500/30'
          }`} />
          
          {/* Canvas container with enhanced styling */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              id="visualizer"
              className={`rounded-full transition-all duration-700 ${
                isPlaying ? 'scale-110 brightness-110' : 'scale-100 brightness-75'
              } filter backdrop-blur-sm`}
              style={{ 
                width: '320px', 
                height: '320px',
                boxShadow: `inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px ${
                  audioMode === 'binaural' ? 'rgba(139,69,255,0.2)' :
                  audioMode === 'noise' ? 'rgba(100,116,139,0.2)' :
                  'rgba(255,165,0,0.2)'
                }`
              }}
            />
            
            {/* Center play/pause overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={isPlaying ? stopAudio : startAudio}
                className={`w-20 h-20 rounded-full backdrop-blur-md transition-all duration-300 
                  border border-white/20 hover:border-white/40 hover:scale-110 group
                  ${isPlaying ? 'bg-black/20 hover:bg-black/30' : 'bg-white/10 hover:bg-white/20'}
                `}
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10 text-white mx-auto group-hover:scale-110 transition-transform" />
                ) : (
                  <Play className="w-10 h-10 text-white mx-auto ml-1 group-hover:scale-110 transition-transform" />
                )}
              </button>
            </div>
          </div>
          
          {/* Frequency display */}
          {audioMode === 'binaural' && (
            <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center">
              <div className="text-3xl font-light text-white/90 mb-2">
                {beatFrequency.toFixed(1)} <span className="text-lg text-white/60">Hz</span>
              </div>
              <div className="text-sm text-white/60 uppercase tracking-widest">
                {getBeatCategory(beatFrequency)} Wave
              </div>
            </div>
          )}
        </div>

        {/* Floating Control Panels */}
        <div className="relative w-full max-w-6xl mx-auto">
          
          {/* Left Panel - Audio Mode & Settings */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 hidden lg:block">
            <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6 min-w-[200px]">
              
              {/* Audio Mode Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider">Mode</h3>
                <div className="space-y-2">
                  {[
                    { value: 'binaural', label: 'Binaural', icon: '🧠' },
                    { value: 'noise', label: 'Ambient', icon: '🌊' },
                    { value: 'om', label: 'Meditation', icon: '🕉️' }
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setAudioMode(mode.value as any)}
                      className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-300 border ${
                        audioMode === mode.value
                          ? 'bg-white/20 border-white/30 text-white shadow-lg'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="mr-3 text-lg">{mode.icon}</span>
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Noise Type Selection */}
              {audioMode === 'noise' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider">Sound</h3>
                  <NoiseGenerator noiseType={noiseType} setNoiseType={handleNoiseTypeChange} />
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Session Controls */}
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 hidden lg:block">
            <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6 min-w-[200px]">
              
              {/* Timer Display */}
              <div className="text-center space-y-2">
                <div className="text-4xl font-light text-white tabular-nums">
                  {formatTime(timer)}
                </div>
                <div className="text-sm text-white/60">
                  / {formatTime(selectedDuration)}
                </div>
                <div className="w-full bg-white/10 rounded-full h-1">
                  <div 
                    className="bg-gradient-to-r from-purple-400 to-blue-400 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${((selectedDuration - timer) / selectedDuration) * 100}%` }}
                  />
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider">Session</h3>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleDurationSelect(preset.duration)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        selectedDuration === preset.duration
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider">Audio</h3>
                  <button
                    onClick={handleMuteToggle}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-white/70" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-white/70" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Control Panel */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4">
            {/* Mobile Timer and Controls */}
            <div className="flex items-center justify-between">
              <div className="text-white/90 font-mono text-lg">
                {formatTime(timer)}
              </div>
              
              {/* Audio Mode Toggle */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setAudioMode('binaural')}
                  className={`p-2 rounded-lg text-xs ${audioMode === 'binaural' ? 'bg-purple-500/30 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  🧠
                </button>
                <button
                  onClick={() => setAudioMode('noise')}
                  className={`p-2 rounded-lg text-xs ${audioMode === 'noise' ? 'bg-gray-500/30 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  🌊
                </button>
                <button
                  onClick={() => setAudioMode('om')}
                  className={`p-2 rounded-lg text-xs ${audioMode === 'om' ? 'bg-orange-500/30 text-white' : 'bg-white/10 text-white/60'}`}
                >
                  🕉️
                </button>
              </div>
              
              <button
                onClick={handleMuteToggle}
                className="p-2 rounded-lg bg-white/10 border border-white/20"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white/70" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white/70" />
                )}
              </button>
            </div>

            {/* Quick Duration Controls */}
            <div className="flex space-x-2 overflow-x-auto">
              {TIME_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleDurationSelect(preset.duration)}
                  className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap ${
                    selectedDuration === preset.duration
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/70 border border-white/10'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Mobile Frequency Controls */}
            {audioMode === 'binaural' && (
              <div className="flex space-x-2 overflow-x-auto">
                {[
                  { freq: 2, label: 'Delta' },
                  { freq: 6, label: 'Theta' },
                  { freq: 10, label: 'Alpha' },
                  { freq: 20, label: 'Beta' }
                ].map((preset) => (
                  <button
                    key={preset.freq}
                    onClick={() => {
                      setBeatFrequency(preset.freq);
                      setCurrentPreset(preset.label.toLowerCase());
                    }}
                    className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border ${
                      Math.abs(beatFrequency - preset.freq) < 0.1
                        ? 'bg-purple-500/30 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/70'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Mobile Noise Type */}
            {audioMode === 'noise' && (
              <div className="overflow-x-auto">
                <NoiseGenerator noiseType={noiseType} setNoiseType={handleNoiseTypeChange} />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel - Frequency Control (Desktop) */}
        {audioMode === 'binaural' && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl hidden lg:block">
            <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              
              {/* Frequency Presets */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { freq: 2, label: 'Delta', desc: 'Deep Sleep', color: 'from-blue-500 to-indigo-600' },
                  { freq: 6, label: 'Theta', desc: 'REM & Dreams', color: 'from-purple-500 to-blue-500' },
                  { freq: 10, label: 'Alpha', desc: 'Relaxed Focus', color: 'from-green-500 to-blue-500' },
                  { freq: 20, label: 'Beta', desc: 'Alert Focus', color: 'from-yellow-500 to-orange-500' }
                ].map((preset) => (
                  <button
                    key={preset.freq}
                    onClick={() => {
                      setBeatFrequency(preset.freq);
                      setCurrentPreset(preset.label.toLowerCase());
                    }}
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      Math.abs(beatFrequency - preset.freq) < 0.1
                        ? `bg-gradient-to-br ${preset.color} border-white/30 text-white shadow-lg scale-105`
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:scale-102'
                    }`}
                  >
                    <div className="text-lg font-semibold">{preset.label}</div>
                    <div className="text-xs opacity-75">{preset.desc}</div>
                    <div className="text-sm font-mono mt-1">{preset.freq}Hz</div>
                  </button>
                ))}
              </div>

              {/* Custom Frequency Slider */}
              <BinauralBeats
                beatFrequency={beatFrequency}
                setBeatFrequency={setBeatFrequency}
                currentPreset={currentPreset}
                setCurrentPreset={setCurrentPreset}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
