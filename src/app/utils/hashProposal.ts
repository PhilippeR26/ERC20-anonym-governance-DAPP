import { CairoByteArray, ec, hash, transaction, type BigNumberish } from "starknet";

function hashByteArray(text: CairoByteArray): string {
  return hash.computeHashOnElements(text.toApiRequest());
}

export function hashProposal(description: string): string {
  const hashString = hashByteArray(new CairoByteArray(description));
  const dataToHash = [
    ...transaction.getExecuteCalldata([], "1"),
    hashString,
  ];
  return dataToHash
    .reduce(
      (x: BigNumberish, y: BigNumberish) => ec.starkCurve.pedersen(BigInt(x), BigInt(y)),
      0,
    )
    .toString();
}
