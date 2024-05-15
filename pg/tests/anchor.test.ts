const [rewardAccount] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("initialReward", "utf8"),
    pg.wallet.publicKey.toBuffer(),
  ],
  pg.program.programId
);

const [newRpsAccount] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("initialGame", "utf8"),
    pg.wallet.publicKey.toBuffer(),
  ],
  pg.program.programId
);

const CHEST_REWARD = 3000000000;
const TRANSACTION_COST = 5000;

describe("Test", () => {
  it("initialize", async () => {
    let rpsAccount;

    let data = "Paper".toString();

    try {
      let account = await pg.program.account.rpsAccount.fetch(newRpsAccount);

      console.log("On-chain data is:", account.answer);
    } catch {
      let txHash = await pg.program.methods
        .initialize(data)
        .accounts({
          rewardAccount: rewardAccount,
          newRpsAccount: newRpsAccount,
          signer: pg.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([pg.wallet.keypair])
        .rpc();
        
      console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
      await pg.connection.confirmTransaction(txHash);

      let newAccount = await pg.program.account.rpsAccount.fetch(
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
    let balanceBefore = await pg.connection.getBalance(pg.wallet.publicKey);
    console.log(`My balance before deposit: ${balanceBefore} SOL`);

    let txHash = await pg.program.methods
        .depositReward()
        .accounts({
          rewardAccount: rewardAccount,
          signer: pg.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([pg.wallet.keypair])
        .rpc();
        
    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await pg.connection.confirmTransaction(txHash);

    let balanceAfter = await pg.connection.getBalance(pg.wallet.publicKey);
    console.log(`My balance after deposit: ${balanceAfter} SOL`);

    assert(balanceBefore - CHEST_REWARD - TRANSACTION_COST == balanceAfter);
  });

  it("change answer", async () => {
    let data = "Scissors".toString();

    let txHash = await pg.program.methods
      .newAnswer(data)
      .accounts({
        rpsAccount: newRpsAccount,
        signer: pg.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([pg.wallet.keypair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await pg.connection.confirmTransaction(txHash);

    let newAccount = await pg.program.account.rpsAccount.fetch(
      newRpsAccount
    );

    assert(newAccount.answer.scissors);
  });

  it("try to win", async () => {
    let balanceBefore = await pg.connection.getBalance(pg.wallet.publicKey);

    let txHash = await pg.program.methods
      .getWinner()
      .accounts({
        rewardAccount: rewardAccount,
        rpsAccount: newRpsAccount,
        signer: pg.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([pg.wallet.keypair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await pg.connection.confirmTransaction(txHash);

    let balanceAfter = await pg.connection.getBalance(pg.wallet.publicKey);

    if (balanceAfter < balanceBefore) {
      console.log(`Unfortunately, you have lost. Your current balance ${balanceAfter / 1000000000}.`);
    } else {
      console.log(`Congratulations! You're the winner! Your current balance ${balanceAfter / 1000000000}.`);
    }
  });
});