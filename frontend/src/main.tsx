import { WalletProvider } from './WalletProvider'
import App from './App'
import './index.css'

export default function Root() {
  return (
    <WalletProvider>
      <App />
    </WalletProvider>
  )
}
