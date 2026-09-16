// Custom entry to expose viem functions needed for AgentPact
import { encodeFunctionData, decodeFunctionResult, keccak256, createPublicClient, http, getContract, parseEther, formatEther } from 'viem';

window.viem = {
  encodeFunctionData,
  decodeFunctionResult,
  keccak256,
  createPublicClient,
  http,
  getContract,
  parseEther,
  formatEther
};
