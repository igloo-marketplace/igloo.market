import { Link, useLocation } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import styles from './Header.module.css';

export function Header() {
    const location = useLocation();
    const { open } = useAppKit();
    const { address, isConnected } = useAccount();

    const navItems = [
        { path: '/', label: 'Home' },
        { path: '/explore', label: 'Explore' },
        { path: '/sell', label: 'Sell' },
        { path: '/mint', label: 'CTC-1 Mint!', highlight: true },
    ];

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <Link to="/" className={styles.logo}>
                    <span className={styles.logoIcon}>🐧</span>
                    <span className={styles.logoText}>igloo.market</span>
                </Link>

                <nav className={styles.nav}>
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`${styles.navLink} ${location.pathname === item.path ? styles.active : ''} ${'highlight' in item && item.highlight ? styles.highlight : ''}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className={styles.actions}>
                    {isConnected ? (
                        <button
                            className={styles.walletBtn}
                            onClick={() => open({ view: 'Account' })}
                        >
                            <span className={styles.walletDot} />
                            {truncateAddress(address!)}
                        </button>
                    ) : (
                        <button
                            className={`btn btn-primary ${styles.connectBtn}`}
                            onClick={() => open()}
                        >
                            Connect
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
