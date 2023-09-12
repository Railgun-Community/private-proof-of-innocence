import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  nToHex,
  hexToBigInt,
  ByteLength,
  numberify,
  hexlify,
} from '@railgun-community/wallet';
import { POIMerkletreeDatabase } from '../database/databases/poi-merkletree-database';
import { poseidon } from 'circomlibjs';
import { MerkleProof } from '../models/proof-types';
import { POIMerkletreeDBItem } from '../models/database-types';

// Static value from calculation in RAILGUN Engine SDK.
const MERKLE_ZERO_VALUE: string =
  '0488f89b25bc7011eaf6a5edce71aeafb9fe706faa3c0a5cd9cbe868ae3b9ffc';

const TREE_DEPTH = 16;
const TREE_MAX_ITEMS = 65_536;

export class POIMerkletree {
  private readonly db: POIMerkletreeDatabase;

  private readonly listKey: string;

  readonly zeros: string[] = [];

  private treeLengths: number[] = [];

  private isUpdating = false;

  private readonly cachedNodeHashes: {
    [tree: number]: { [level: number]: { [index: number]: string } };
  } = {};

  constructor(networkName: NetworkName, listKey: string) {
    this.db = new POIMerkletreeDatabase(networkName);
    this.listKey = listKey;
    this.calculateZeros();
  }

  private calculateZeros() {
    this.zeros[0] = MERKLE_ZERO_VALUE;
    for (let level = 1; level <= TREE_DEPTH; level += 1) {
      this.zeros[level] = POIMerkletree.hashLeftRight(
        this.zeros[level - 1],
        this.zeros[level - 1],
      );
    }
  }

  private static hashLeftRight(left: string, right: string): string {
    return nToHex(
      poseidon([hexToBigInt(left), hexToBigInt(right)]),
      ByteLength.UINT_256,
    );
  }

  async getMerkleProof(tree: number, index: number): Promise<MerkleProof> {
    // Fetch leaf
    const leaf = await this.getNodeHash(tree, 0, index);

    // Get indexes of path elements to fetch
    const elementsIndexes: number[] = [index ^ 1];

    // Loop through each level and calculate index
    while (elementsIndexes.length < TREE_DEPTH) {
      // Shift right and flip last bit
      elementsIndexes.push(
        (elementsIndexes[elementsIndexes.length - 1] >> 1) ^ 1,
      );
    }

    // Fetch path elements
    const elements = await Promise.all(
      elementsIndexes.map((elementIndex, level) =>
        this.getNodeHash(tree, level, elementIndex),
      ),
    );

    // Convert index to bytes data, the binary representation is the indices of the merkle path
    const indices = nToHex(BigInt(index), ByteLength.UINT_256);

    // Fetch root
    const root = await this.getRoot(tree);

    // Return proof
    return {
      leaf,
      elements,
      indices,
      root,
    };
  }

  getRoot(tree: number): Promise<string> {
    return this.getNodeHash(tree, TREE_DEPTH, 0);
  }

  private async getNodeHash(
    tree: number,
    level: number,
    index: number,
  ): Promise<string> {
    if (
      isDefined(this.cachedNodeHashes[tree]) &&
      isDefined(this.cachedNodeHashes[tree][level]) &&
      this.cachedNodeHashes[tree][level][index]
    ) {
      return this.cachedNodeHashes[tree][level][index];
    }
    const hash = await this.db.getPOINodeHash(this.listKey, tree, level, index);
    if (!isDefined(hash)) {
      return this.zeros[level];
    }
    this.cacheNodeHash(tree, level, index, hash);
    return hash;
  }

  private cacheNodeHash(
    tree: number,
    level: number,
    index: number,
    hash: string,
  ) {
    this.cachedNodeHashes[tree] ??= {};
    this.cachedNodeHashes[tree][level] ??= {};
    this.cachedNodeHashes[tree][level][index] = hash;
  }

  private createDBItem(
    tree: number,
    level: number,
    index: number,
    nodeHash: string,
  ): POIMerkletreeDBItem {
    return {
      listKey: this.listKey,
      tree,
      level,
      index,
      nodeHash,
    };
  }

  private async getTreeLengthFromDBCount(tree: number): Promise<number> {
    return this.db.countLeavesInTree(this.listKey, tree);
  }

  async getTreeLength(treeIndex: number): Promise<number> {
    if (this.treeLengths[treeIndex] != null) {
      return this.treeLengths[treeIndex];
    }

    this.treeLengths[treeIndex] =
      await this.getTreeLengthFromDBCount(treeIndex);
    return this.treeLengths[treeIndex];
  }

  private async latestTree(): Promise<number> {
    let latestTree = 0;
    while ((await this.getTreeLength(latestTree)) > 0) latestTree += 1;
    return Math.max(0, latestTree - 1);
  }

  private async getLatestTreeAndIndex(): Promise<{
    tree: number;
    index: number;
  }> {
    const latestTree = await this.latestTree();
    const treeLength = await this.getTreeLength(latestTree);
    return { tree: latestTree, index: treeLength - 1 };
  }

  private async getNextTreeAndIndex(): Promise<{
    tree: number;
    index: number;
  }> {
    const { tree: latestTree, index: latestIndex } =
      await this.getLatestTreeAndIndex();

    if (latestIndex + 1 >= TREE_MAX_ITEMS) {
      return { tree: latestTree + 1, index: 0 };
    }
    return { tree: latestTree, index: latestIndex + 1 };
  }

  async insertLeaf(nodeHash: string): Promise<void> {
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;

    const { tree, index } = await this.getNextTreeAndIndex();

    const firstLevelHashWriteGroup: string[][] = [];
    firstLevelHashWriteGroup[0] = [];
    firstLevelHashWriteGroup[0][index] = nodeHash;

    const hashWriteGroup: string[][] = await this.fillHashWriteGroup(
      firstLevelHashWriteGroup,
      tree,
      index,
      index + 1, // endIndex
    );

    await this.writeToDB(tree, hashWriteGroup);
    this.treeLengths[tree] += 1;

    this.isUpdating = false;
  }

  async rebuildTree(tree: number): Promise<void> {
    const firstLevelHashWriteGroup: string[][] = [];

    firstLevelHashWriteGroup[0] = [];

    // Should not use cached treeLength value here because it can be stale.
    const treeLength = await this.getTreeLengthFromDBCount(tree);

    const nodeFetcher = new Array<Promise<Optional<string>>>(treeLength);

    // Fetch each leaf we need to scan
    for (let index = 0; index < treeLength; index += 1) {
      nodeFetcher[index] = this.getNodeHash(tree, 0, index);
    }
    const leaves = await Promise.all(nodeFetcher);

    // Push values to leaves of write index
    leaves.forEach((hash, index) => {
      firstLevelHashWriteGroup[0][index] = hash ?? this.zeros[0];
    });

    const startIndex = 0;
    const endIndex = treeLength - 1;

    const hashWriteGroup: string[][] = await this.fillHashWriteGroup(
      firstLevelHashWriteGroup,
      tree,
      startIndex,
      endIndex,
    );

    const items: POIMerkletreeDBItem[] = [];
    hashWriteGroup.forEach((levelItems, level) => {
      levelItems.forEach((nodeHash, index) => {
        const item: POIMerkletreeDBItem = this.createDBItem(
          tree,
          level,
          index,
          nodeHash,
        );
        items.push(item);
      });
    });

    // Delete tree in DB
    await this.db.deleteAllPOIMerkletreeNodesForTree(this.listKey, tree);

    // Re-insert entire tree in DB
    await this.db.updatePOIMerkletreeNodes(items);
  }

  private async fillHashWriteGroup(
    firstLevelHashWriteGroup: string[][],
    tree: number,
    startIndex: number,
    endIndex: number,
  ): Promise<string[][]> {
    const hashWriteGroup: string[][] = firstLevelHashWriteGroup;

    let level = 0;

    let index = startIndex;
    let nextLevelStartIndex = startIndex;
    let nextLevelEndIndex = endIndex;

    // Loop through each level and calculate values
    while (level < TREE_DEPTH) {
      // Set starting index for this level
      index = nextLevelStartIndex;

      // Ensure writecache array exists for next level
      hashWriteGroup[level] = hashWriteGroup[level] ?? [];
      hashWriteGroup[level + 1] = hashWriteGroup[level + 1] ?? [];

      // Loop through every pair
      for (index; index <= nextLevelEndIndex + 1; index += 2) {
        let nodeHash: string;

        if (index % 2 === 0) {
          // Left
          nodeHash = POIMerkletree.hashLeftRight(
            hashWriteGroup[level][index] ||
              (await this.getNodeHash(tree, level, index)),
            hashWriteGroup[level][index + 1] ||
              (await this.getNodeHash(tree, level, index + 1)),
          );
        } else {
          // Right
          nodeHash = POIMerkletree.hashLeftRight(
            hashWriteGroup[level][index - 1] ||
              (await this.getNodeHash(tree, level, index - 1)),
            hashWriteGroup[level][index] ||
              (await this.getNodeHash(tree, level, index)),
          );
        }

        hashWriteGroup[level + 1][index >> 1] = nodeHash;
      }

      // Calculate starting and ending index for the next level
      nextLevelStartIndex >>= 1;
      nextLevelEndIndex >>= 1;

      // Increment level
      level += 1;
    }

    return hashWriteGroup;
  }

  private async writeToDB(tree: number, hashWriteGroup: string[][]) {
    const items: POIMerkletreeDBItem[] = [];
    hashWriteGroup.forEach((levelItems, level) => {
      levelItems.forEach((nodeHash, index) => {
        this.cacheNodeHash(tree, level, index, nodeHash);
        const item: POIMerkletreeDBItem = this.createDBItem(
          tree,
          level,
          index,
          nodeHash,
        );
        items.push(item);
      });
    });
    await this.db.updatePOIMerkletreeNodes(items);
  }

  static verifyProof(proof: MerkleProof): boolean {
    // Get indices as BN form
    const indices = numberify(proof.indices);

    // Calculate proof root and return if it matches the proof in the MerkleProof
    // Loop through each element and hash till we've reduced to 1 element
    const calculatedRoot = proof.elements.reduce((current, element, index) => {
      // If index is right
      if (indices.testn(index)) {
        return POIMerkletree.hashLeftRight(element, current);
      }

      // If index is left
      return POIMerkletree.hashLeftRight(current, element);
    }, proof.leaf);

    return hexlify(proof.root) === hexlify(calculatedRoot);
  }
}
