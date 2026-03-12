import { FallbackProvider, JsonRpcProvider, type AbstractProvider } from "ethers";

let cachedProvider: AbstractProvider | null = null;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function getEthereumProvider(): AbstractProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const configured = process.env.ETH_RPC_URL?.trim();
  const rpcUrls = unique([
    configured || "",
    "https://eth.llamarpc.com",
    "https://ethereum-rpc.publicnode.com",
    "https://cloudflare-eth.com",
  ]);

  if (rpcUrls.length === 1) {
    cachedProvider = new JsonRpcProvider(rpcUrls[0], 1, { staticNetwork: true });
    return cachedProvider;
  }

  const providers = rpcUrls.map((url, index) => ({
    provider: new JsonRpcProvider(url, 1, { staticNetwork: true }),
    priority: index + 1,
    weight: 1,
    stallTimeout: 1_250,
  }));

  cachedProvider = new FallbackProvider(providers, 1);
  return cachedProvider;
}
