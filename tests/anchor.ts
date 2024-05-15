import assert from "assert";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { TestContract } from "../target/types/test_contract";
const [rewardAccount] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("initialReward", "utf8"),
    program.provider.publicKey.toBuffer(),
  ],
  program.programId
);

const [newRpsAccount] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("initialGame", "utf8"),
    program.provider.publicKey.toBuffer(),
  ],
  program.programId
);

const CHEST_REWARD = 3000000000;
const TRANSACTION_COST = 5000;

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TestContract as anchor.Program<TestContract>;
  
  it("initialize", async () => {
    let rpsAccount;

    let data = "Paper".toString();

    try {
      let account = await program.account.rpsAccount.fetch(newRpsAccount);

      console.log("On-chain data is:", account.answer);
    } catch {
      let txHash = await program.methods
        .initialize(data)
        .accounts({
          rewardAccount: rewardAccount,
          newRpsAccount: newRpsAccount,
          signer: program.provider.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([program.provider.wallet.payer])
        .rpc();
        
      console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
      await program.provider.connection.confirmTransaction(txHash);

      let newAccount = await program.account.rpsAccount.fetch(
        newRpsAccount
      );

      console.log("On-chain data is:", newAccount.answer);

      let answer;

      if (data === "Paper") {
        answer = newAccount.answer.paper;
      } else if (data === "Rock") {
        answer = newAccount.answer.rock;
      } else if (data === "Scissors") {
        answer = newAccount.answer.scissors;
      }

      assert(answer);
    }
  });

  it("deposit", async () => {
    let balanceBefore = await program.provider.connection.getBalance(program.provider.publicKey);
    console.log(`My balance before deposit: ${balanceBefore} SOL`);

    let txHash = await program.methods
        .depositReward()
        .accounts({
          rewardAccount: rewardAccount,
          signer: program.provider.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([program.provider.wallet.payer])
        .rpc();
        
    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);

    let balanceAfter = await program.provider.connection.getBalance(program.provider.publicKey);
    console.log(`My balance after deposit: ${balanceAfter} SOL`);

    assert(balanceBefore - CHEST_REWARD - TRANSACTION_COST == balanceAfter);
  });

  it("change answer", async () => {
    let data = "Scissors".toString();

    let txHash = await program.methods
      .newAnswer(data)
      .accounts({
        rpsAccount: newRpsAccount,
        signer: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([program.provider.wallet.payer])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);

    let newAccount = await program.account.rpsAccount.fetch(
      newRpsAccount
    );

    assert(newAccount.answer.scissors);
  });

  it("try to win", async () => {
    let balanceBefore = await program.provider.connection.getBalance(program.provider.publicKey);

    let txHash = await program.methods
      .getWinner()
      .accounts({
        rewardAccount: rewardAccount,
        rpsAccount: newRpsAccount,
        signer: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([program.provider.wallet.payer])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);

    let balanceAfter = await program.provider.connection.getBalance(program.provider.publicKey);

    if (balanceAfter < balanceBefore) {
      console.log(`Unfortunately, you have lost. Your current balance ${balanceAfter / 1000000000}.`);
    } else {
      console.log(`Congratulations! You're the winner! Your current balance ${balanceAfter / 1000000000}.`);
    }
  });
});