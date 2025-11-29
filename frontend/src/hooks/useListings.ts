import { useQuery } from '@tanstack/react-query';
import { getListings, getListing, getUserListings, getStatistics } from './useApi';

export function useListings(limit = 50, offset = 0) {
    return useQuery({
        queryKey: ['listings', limit, offset],
        queryFn: () => getListings(limit, offset),
        staleTime: 10000, // 10 seconds
    });
}

export function useListing(id: number) {
    return useQuery({
        queryKey: ['listing', id],
        queryFn: () => getListing(id),
        enabled: !!id,
    });
}

export function useUserListings(address: string | undefined) {
    return useQuery({
        queryKey: ['userListings', address],
        queryFn: () => getUserListings(address!),
        enabled: !!address,
    });
}

export function useStatistics() {
    return useQuery({
        queryKey: ['statistics'],
        queryFn: getStatistics,
        staleTime: 30000, // 30 seconds
    });
}
