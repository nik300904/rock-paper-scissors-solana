use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

declare_id!("4cRuEdrN1psiLR9kejes449yGJTrKfM4XfRW2EMxhKtf");

#[program]
pub mod test_contract {
    use super::*;

    #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
    pub enum Choice {
        Scissors,
        Paper,
        Rock,
    }

    #[error_code]
    pub enum GameError {
        #[msg("Available only Rock, Paper and Scissors")]
        WrongParametrs,
        #[msg("The public key of the signer of this transaction does not match the current public key of the account")]
        InvalidSigner,
    }

    const GAME_REWARD: u64 = LAMPORTS_PER_SOL * 3;

    /// Initializes account for a Rock-Paper-Scissors game.
    pub fn initialize(ctx: Context<Initialize>, answer: String) -> Result<()> {
        let new_account = &mut ctx.accounts.new_rps_account;

        let answer = match answer.as_str() {
            "Paper" => Choice::Paper,
            "Scissors" => Choice::Scissors,
            "Rock" => Choice::Rock,
            // _ => Choice::Rock,
            _ => return err!(GameError::WrongParametrs),
        };

        new_account.answer = answer;
        new_account.owner = *ctx.accounts.signer.key;

        msg!("Game initialized. Your choise {:#?}", answer);

        Ok(())
    }

    // Deposit 3 Sol to reward account
    pub fn deposit_reward(ctx: Context<DepositReward>) -> Result<()> {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.signer.to_account_info().clone(),
                to: ctx.accounts.reward_account.to_account_info().clone()
            },
        );
        system_program::transfer(cpi_context, GAME_REWARD)?;

        msg!("Reward was {} Sol", GAME_REWARD / 1000000000);

        Ok(())
    }

    // Change current answer to specified
    pub fn new_answer(ctx: Context<ChangeAnswer>, answer: String) -> Result<()> {
        if *ctx.accounts.signer.key != ctx.accounts.rps_account.owner {
            return err!(GameError::InvalidSigner);
        }

        let answer = match answer.as_str() {
            "Paper" => Choice::Paper,
            "Scissors" => Choice::Scissors,
            "Rock" => Choice::Rock,
            _ => return err!(GameError::WrongParametrs),
        };

        let ctx = &mut ctx.accounts.rps_account;

        ctx.answer = answer;

        Ok(())
    }

    // Choice winner by getting hash of time and divie by len words
    pub fn get_winner(ctx: Context<GetWinner>) -> Result<()> {
        if *ctx.accounts.signer.key != ctx.accounts.rps_account.owner {
            return err!(GameError::InvalidSigner);
        }

        let words = [Choice::Rock, Choice::Paper, Choice::Scissors];

        let clock: Clock = Clock::get().unwrap();
        let current_timestamp = clock.unix_timestamp;

        let random_hash =
            anchor_lang::solana_program::keccak::hashv(&[&current_timestamp.to_le_bytes()]);

        let random_index = (random_hash.to_bytes()[0] as usize) % words.len();

        let selected_word = words[random_index];

        match (ctx.accounts.rps_account.answer, selected_word) {
            (Choice::Rock, Choice::Scissors)
            | (Choice::Paper, Choice::Rock)
            | (Choice::Scissors, Choice::Paper) => {
                msg!(
                    "Your answer {:#?}. Time answer {:#?}",
                    ctx.accounts.rps_account.answer,
                    selected_word
                );

                **ctx
                    .accounts
                    .reward_account
                    .to_account_info()
                    .try_borrow_mut_lamports()? -= GAME_REWARD;

                **ctx
                    .accounts
                    .signer
                    .to_account_info()
                    .try_borrow_mut_lamports()? += GAME_REWARD;

                msg!("You win! U got {:#?} Sol!", GAME_REWARD / 1000000000);
            }
            (Choice::Rock, Choice::Rock)
            | (Choice::Paper, Choice::Paper)
            | (Choice::Scissors, Choice::Scissors) => {
                msg!(
                    "Your answer {:#?}. Time answer {:#?}",
                    ctx.accounts.rps_account.answer,
                    selected_word
                );
                msg!("Draw!");
            }
            _ => {
                msg!(
                    "Your answer {:#?}. Time answer {:#?}",
                    ctx.accounts.rps_account.answer,
                    selected_word
                );
                msg!("You lose!");
            }
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + 1 + 32,
        seeds = [b"initialGame", signer.key().as_ref()],
        bump,
    )]
    pub new_rps_account: Account<'info, RpsAccount>,
    #[account(
        init_if_needed, 
        payer = signer,
        space = 8,
        seeds = [b"initialReward", signer.key().as_ref()],
        bump,
    )]
    pub reward_account: Account<'info, RpsReward>,
    #[account(mut)] 
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositReward<'info> {
    #[account(mut)] 
    pub signer: Signer<'info>,
    #[account(mut)]
    pub reward_account: Account<'info, RpsReward>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct ChangeAnswer<'info> {
    #[account(mut)]
    pub rps_account: Account<'info, RpsAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetWinner<'info> {
    #[account(mut)]
    pub reward_account: Account<'info, RpsReward>,
    #[account(mut)]
    pub rps_account: Account<'info, RpsAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct RpsAccount {
    answer: Choice,
    owner: Pubkey,
}

#[account]
pub struct RpsReward {}
