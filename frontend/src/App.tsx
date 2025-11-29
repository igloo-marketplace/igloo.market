import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Home } from './pages/Home';
import { Explore } from './pages/Explore';
import { NFTDetail } from './pages/NFTDetail';
import { Sell } from './pages/Sell';
import { Mint } from './pages/Mint';

function App() {
    return (
        <BrowserRouter>
            <Header />
            <main style={{ flex: 1 }}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/nft/:contract/:tokenId" element={<NFTDetail />} />
                    <Route path="/sell" element={<Sell />} />
                    <Route path="/mint" element={<Mint />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
