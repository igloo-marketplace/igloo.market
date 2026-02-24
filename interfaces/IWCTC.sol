// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IWCTC — Wrapped CTC interface (WETH9 standard)
interface IWCTC {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address dst, uint256 wad) external returns (bool);
    function transferFrom(address src, address dst, uint256 wad) external returns (bool);
    function approve(address guy, uint256 wad) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}
