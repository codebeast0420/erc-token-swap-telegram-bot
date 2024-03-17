export const chainConfig = {
	// bsctestnet: {
	//     nativeCurrency: {
	//         label: 'TBNB',
	//         decimals: 18
	//     },
	//     chainId: 97,
	//     rpcUrls: [
	//         // 'https://crimson-evocative-moon.bsc-testnet.quiknode.pro/a8ee30c7c954016bc481199d2aed80ed7fab0582/',
	//         'https://data-seed-prebsc-1-s3.binance.org:8545/'
	//     ],
	//     wsUrls: [
	//         // 'wss://crimson-evocative-moon.bsc-testnet.quiknode.pro/a8ee30c7c954016bc481199d2aed80ed7fab0582/',
	//         'wss://data-seed-prebsc-1-s3.binance.org:8545/ws'
	//     ],
	//     blockExplorer: 'https://testnet.bscscan.com',
	//     blockExplorerApiKey: 'VJ6D3VV58G1CC97BGJJ62CHD21CES1P8SV',
	//     blockExplorerApiEndpoint: 'https://api-testnet.bscscan.com',
	//     router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
	//     factory: '0x6725f303b657a9451d8ba641348b6761a6cc7a17',
	//     feeDistributor: '0x041AC48f11cC4d168abDc3F8f2d8bB5D0A91858b',
	//     tokens: [
	//         '0xae13d989dac2f0debff460ac112a837c89baa7cd' // WBNB
	//     ],
	//     priceFeeds: [
	//         '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526' // BNB price
	//     ],
	//     lpLocksAddress: ['0xC765bddB93b0D1c1A88282BA0fa6B2d00E3e0c83']
	// },
	bsc: {
		nativeCurrency: {
			label: 'BNB',
			decimals: 18
		},
		chainId: 56,
		rpcUrls: [
			'https://go.getblock.io/8291a665e5224b01b9c4d8221c305053',
			'http://ec2-54-191-150-148.us-west-2.compute.amazonaws.com:8545',
			'https://nd-113-174-302.p2pify.com/eebc07a342430fd3c95faf3eeff7347e', // private node
			'https://bsc.getblock.io/f9463dcf-acc5-4ac1-bbdd-b9bbe5858a56/mainnet/', // shared node at getblock.io
			"https://go.getblock.io/f52e813635544bd1bf3b4ab34e9edbe4",
			'https://bsc.getblock.io/28a5ddce-c03e-4519-9b4d-158cf38bd12a/mainnet/', // dedicated node at getblock.io
			// 'https://swift-bsc-node.com', 
		],
		wsUrls: [
			'wss://go.getblock.io/65ce2abe877f41ec87bfcd330d9671a1',
			'wss://bsc.getblock.io/f9463dcf-acc5-4ac1-bbdd-b9bbe5858a56/mainnet/', // shared node at getblock.iohain.parameters.
			// 'ws://swift-bsc-node.com:8546', 
			'ws://ec2-54-191-150-148.us-west-2.compute.amazonaws.com:8546',
			'wss://ws-nd-113-174-302.p2pify.com/eebc07a342430fd3c95faf3eeff7347e', // private node
			'wss://bsc.getblock.io/28a5ddce-c03e-4519-9b4d-158cf38bd12a/mainnet/', // dedicated node at getblock.io
		],
		blockExplorer: 'https://bscscan.com',
		blockExplorerApiKey: 'HX1253WDUE49DX742AHD9AQP9EYI327J3N',
		blockExplorerApiEndpoint: 'https://api.bscscan.com',
		router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
		routerV3: '0x13f4ea83d0bd40e75c8222255bc855a974568dd4',
		factory: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
		feeDistributor: '0x3bf5d3bb85409aadcee31946343d57c9f7817b5d',
		simulator: '0x06f28ea240ac1a8ac83849129fd3e07379eec65c', // {without deduct fee - '0xcc396b18C15f9437fB6d0ffa981640d38D504428'}
		dexURL: 'https://pancakeswap.finance/swap',
		tokens: [
			'0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
			'0x55d398326f99059ff775485246999027b3197955', // USDT
			'0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
			'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' // USDC
		],
		priceFeeds: [
			'0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee', // BNB price
			'0xb97ad0e74fa7d920791e90258a6e2085088b4320', // USDT price
			'0xcbb98864ef56e9042e7d2efef76141f15731b82f', // BUSD price
			'0x51597f405303C4377E36123cBc172b13269EA163' // USDC price
		],
		lpLocksAddress: ['0xc765bddb93b0d1c1a88282ba0fa6b2d00e3e0c83']
	},
	ethereum: {
		nativeCurrency: {
			label: 'ETH',
			decimals: 18
		},
		chainId: 1,
		rpcUrls: [
			// 'https://goerli.blockpi.network/v1/rpc/public',
			// 'https://rpc.ankr.com/eth_goerli',
			// 'https://go.getblock.io/bdf1798a9a49407cb5157896782e6c19', // testnet
			'https://go.getblock.io/a62965ecb76f4390860a027a54738765',
			'https://rpc.mevblocker.io/', // anti-MEV RPC,             'https://rpc.flashbots.net/', // anti-MEV RPC
			'https://mainnet.infura.io/v3/7535811d19b1410e98c261fbb638651a',
			'http://ec2-52-13-16-186.us-west-2.compute.amazonaws.com:8545',
			'https://eth.getblock.io/mainnet/45457240-8f2e-4923-93ea-de09a4da63a0/', // dedicated node at getblock.io
			// 'https://swift-eth-node.com', 
			'https://nd-652-098-924.p2pify.com/02da8a5071fc3168ee861acd034a1338', // private node
		],
		wsUrls: [
			// 'wss://goerli.gateway.tenderly.co',
			// 'wss://go.getblock.io/5d69a662c1ca41a492b35f5c8028abbd', // testnet
			'wss://go.getblock.io/63fd812e1ef94d168d8c5b134e21ab77',
			'wss://eth.getblock.io/mainnet/45457240-8f2e-4923-93ea-de09a4da63a0/', // dedicated node at getblock.io
			// 'ws://swift-eth-node.com:8546',//'ws://ec2-52-13-16-186.us-west-2.compute.amazonaws.com:8546', //'wss://ws-nd-652-098-924.p2pify.com/02da8a5071fc3168ee861acd034a1338', // private node
			'https://eth.getblock.io/f17985ae-6464-4c3e-acfc-b2097d24bf38/mainnet/', // shared node at getblock.io
		],
		blockExplorer: 'https://etherscan.io',
		blockExplorerApiKey: 'B7MKP324RZ9Y38DMQ49BWGMF59FWX7BTIK',
		blockExplorerApiEndpoint: 'https://api.etherscan.io',
		router: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
		antimevSwapper: '0xe6017E4466923f2e9Bf83F9C1e4aBa2686757dC4',
		antimevRPC: 'https://eth-protect.rpc.blxrbdn.com',
		// antimevRPC: 'https://goerli.blockpi.network/v1/rpc/public',

		factory: '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f',
		feeDistributor: '0xa4b19e1abff282e7feb467ff706f116012b4b829',
		simulator: '0x16b7be202c23e8f1a138b3a2dd77b2e7700a2494', // {without deduct fee - '0x74EE2ffb5815E213BC05a1c0732eF2058aC3D303'}
		dexURL: 'https://app.uniswap.org/#/swap',
		tokens: [
			'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
			'0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
			'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
			'0x6b175474e89094c44da98b954eedeac495271d0f' // DAI
		],
		priceFeeds: [
			'0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419',
			'0x3e7d1eab13ad0104d2750b8863b489d65364e32d',
			'0x8fffffd4afb6115b954bd326cbe7b4ba576818f6',
			'0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9'
		],
		lpLocksAddress: ['0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214']
	},
	arbitrum: {
		nativeCurrency: {
			label: 'ETH',
			decimals: 18
		},
		chainId: 42161,
		rpcUrls: [
			'https://arb1.arbitrum.io/rpc',
			'https://arb.getblock.io/1c685c1b-9dc8-4417-baba-01871c133857/mainnet/', // dedicated node at getblock.io
			// 'https://swift-arb-node.com', //'http://ec2-100-20-164-188.us-west-2.compute.amazonaws.com:8547', 
			//'https://nd-470-693-047.p2pify.com/420bc6f24c63ea56f9dab7e7b53064ff', // private node
			'https://arb.getblock.io/5daba08a-a8c1-4208-8963-0bb36f6f0fcc/mainnet/', // shared node at getblock.io
		],
		wsUrls: [
			'wss://arb1.arbitrum.io/ws/rpc',
			'wss://arb.getblock.io/1c685c1b-9dc8-4417-baba-01871c133857/mainnet/', // dedicated node at getblock.io
			// 'ws://swift-arb-node.com:8548', //'ws://ec2-100-20-164-188.us-west-2.compute.amazonaws.com:8548', //'wss://ws-nd-470-693-047.p2pify.com/420bc6f24c63ea56f9dab7e7b53064ff', // private node
			'wss://arb.getblock.io/5daba08a-a8c1-4208-8963-0bb36f6f0fcc/mainnet/', // shared node at getblock.io
		],
		blockExplorer: 'https://arbiscan.io',
		blockExplorerApiKey: '52A5CVCP98VTCK3MQH5ZPM9C6626D48CY1',
		blockExplorerApiEndpoint: 'https://api.arbiscan.io',
		router: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
		factory: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
		feeDistributor: '0x02ddd2b022d61e0488628bb045c1cdedf70d1059',
		simulator: '0x18fbf661c4dc0525370ffef10517762898a6f781',// {without deduct fee - '0x5620AB3f35dC278395559e95C58b22411177af4a'}
		dexURL: 'https://app.sushi.com/swap',
		tokens: [
			'0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
			'0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
			'0xff970a61a04b1ca14834a43f5de4533ebddb5cc8' // USDC
		],
		priceFeeds: [
			'0x639fe6ab55c921f74e7fac1ee960c0b6293ba612',
			'0x3f3f5df88dc9f13eac63df89ec16ef6e7e25dde7',
			'0x50834f3163758fcc1df9973b6e91f0f0f0434ad3'
		],
		lpLocksAddress: ['0x275720567e5955f5f2d53a7a1ab8a0fc643de50e']
	}
};

export const lpLockersConfig = {
	PinkLockv2: {
		chain: 'bsc',
		topic: '0x694af1cc8727cdd0afbdd53d9b87b69248bd490224e9dd090e788546506e076f',
		address: '0x407993575c91ce7643a4d4cCACc9A98c36eE1BBE'
	},
	Unicrypt: {
		chain: 'bsc',
		topic: '0x830357565da6ecfc26d8d9f69df488ed6f70361af9a07e570544aeb5c5e765e5',
		address: '0xC765bddB93b0D1c1A88282BA0fa6B2d00E3e0c83'
	}
};