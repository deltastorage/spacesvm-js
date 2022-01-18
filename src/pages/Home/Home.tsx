import { Twemoji } from 'react-emoji-render'
import { IoCheckmarkCircle, IoClose, IoSearch } from 'react-icons/io5'
import { createSearchParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Fade,
	Grid,
	Grow,
	IconButton,
	InputAdornment,
	Link as MuiLink,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from '@mui/material'
import { styled } from '@mui/system'
import { useSnackbar } from 'notistack'

import ActivityBg from '@/assets/activity2.jpg'
import MetaMaskFoxLogo from '@/assets/metamask-fox.svg'
import { AddressChip } from '@/components/AddressChip/AddressChip'
import { ClaimedDialog } from '@/components/ClaimedDialog'
import { Page } from '@/components/Page'
import { PageSubtitle } from '@/components/PageSubtitle'
import { PageTitle } from '@/components/PageTitle'
import { TypewrittingInput } from '@/components/TypewrittingInput'
import { USERNAME_REGEX_QUERY, USERNAMES, VALID_KEY_REGEX } from '@/constants'
import { useMetaMask } from '@/providers/MetaMaskProvider'
import { purpleButton } from '@/theming/purpleButton'
import { rainbowButton } from '@/theming/rainbowButton'
import { TxType } from '@/types'
import { calculateClaimCost } from '@/utils/calculateCost'
import { getLatestActivity, getSuggestedFee, isAlreadyClaimed } from '@/utils/spacesVM'

const VerifyButton = styled(Button)(({ theme }: any) => ({
	...purpleButton(theme),
}))

export const ClaimButton = styled(Button)(({ theme }: any) => ({
	...rainbowButton(theme),
}))

export const Home = memo(() => {
	const [searchParams] = useSearchParams()
	const { enqueueSnackbar } = useSnackbar()
	const [recentActivity, setRecentActivity] = useState<
		{
			timestamp?: number
			to?: string
			txId?: string
			type?: string
			sender?: string
			space?: string
		}[]
	>([])
	const [claiming, setClaiming] = useState<boolean>(false)
	const { issueTx, signWithMetaMask, balance } = useMetaMask()
	const navigate = useNavigate()
	const [showClaimedDialog, setShowClaimedDialog] = useState<boolean>(false)
	const [waitingForMetaMask, setWaitingForMetaMask] = useState<boolean>(false)
	const [username, setUsername] = useState<string>(
		searchParams.get('ref')?.toLowerCase().replace(USERNAME_REGEX_QUERY, '') || '',
	) // pre-fill if ?ref=something in URL
	const theme = useTheme()
	const [verified, setVerified] = useState<boolean>(false)
	const [available, setAvailable] = useState<boolean>(false)
	const [costEstimate, setCostEstimate] = useState<number>()

	const onVerify = async () => {
		// setting `?ref=USERNAME` in URL to persist refresh
		navigate({
			pathname: '',
			search: `?${createSearchParams({
				ref: username,
			})}`,
		})
		const isClaimed = await isAlreadyClaimed(username)
		setVerified(true)
		setAvailable(!isClaimed)
	}

	useEffect(() => {
		if (username.length === 0) {
			setCostEstimate(undefined)
			return
		}
		setCostEstimate(calculateClaimCost(username))
	}, [username])

	useEffect(() => {
		const fetchRecentActivity = async () => {
			const activity = await getLatestActivity()
			console.log(activity)
			setRecentActivity(activity.activity)
		}
		fetchRecentActivity()
	}, [])

	const onClaim = async () => {
		if (balance < calculateClaimCost(username)) {
			enqueueSnackbar("You don't have enough SPC to claim this space!  Tip: Longer names are cheaper. 😉", {
				variant: 'error',
			})
			return
		}

		setWaitingForMetaMask(true)
		const { typedData } = await getSuggestedFee({ type: TxType.Claim, space: username })
		const signature = await signWithMetaMask(typedData)
		setWaitingForMetaMask(false)
		if (!signature) return
		setClaiming(true)
		const claimSuccess = await issueTx(typedData, signature)
		if (!claimSuccess) {
			// Show something in the UI to display the claim failed
			return
		}
		onClaimSuccess()
	}

	const onClaimSuccess = async () => {
		setClaiming(false)
		setAvailable(false)
		setVerified(false)
		setShowClaimedDialog(true)
	}

	const handleSubmit = (e: any) => {
		e.preventDefault()
	}

	return (
		<Page>
			<ClaimedDialog spaceId={username} open={showClaimedDialog} onClose={() => setShowClaimedDialog(false)} />

			<Dialog open={waitingForMetaMask} maxWidth="xs">
				<DialogTitle>
					<Typography
						variant="h5"
						component="p"
						fontFamily="DM Serif Display"
						align="center"
						sx={{ position: 'relative' }}
					>
						Please sign the message in your wallet to continue.{' '}
						<span style={{ position: 'absolute', fontSize: 36, transform: 'translateX(8px) translateY(-3px)' }}>
							<Twemoji svg text="👉" />
						</span>
					</Typography>
				</DialogTitle>
				<DialogContent>
					<Typography align="center" color="textSecondary">
						Verify that you're the owner of this Ethereum address and any associated Spaces.
					</Typography>
					<Box sx={{ mt: 4 }} display="flex" justifyContent="center">
						<CircularProgress color="secondary" disableShrink />
					</Box>
				</DialogContent>
			</Dialog>

			<form onSubmit={handleSubmit} autoComplete="off">
				<PageTitle align="center" lineHeight={1} mt={2}>
					Claim your space
				</PageTitle>
				<PageSubtitle align="center">Needs to be unique and lowercase.</PageSubtitle>

				<Grid container spacing={4} flexDirection="column" alignItems="center">
					<Grid item>
						<TypewrittingInput waitBeforeDeleteMs={2000} strings={USERNAMES}>
							{({ currentText }) => (
								<TextField
									disabled={available && verified}
									value={username}
									onChange={(e) => {
										if (e.target.value === '' || VALID_KEY_REGEX.test(e.target.value)) {
											setVerified(false)
											setUsername(e.target.value.toLowerCase())
										}
									}}
									placeholder={currentText.toLowerCase()}
									fullWidth
									autoFocus
									InputProps={{
										sx: {
											fontSize: {
												xs: 24,
												sm: 42,
												md: 80,
											},
											fontWeight: 900,
											fontFamily: 'DM Serif Display',
										},
										startAdornment: (
											<InputAdornment sx={{ marginRight: 4 }} position="start">
												<IoSearch color="grey" />
											</InputAdornment>
										),
										endAdornment: (
											<InputAdornment position="end" sx={{ width: 80, height: 80 }}>
												{verified && available && (
													<Fade in>
														<Tooltip placement="top" title="Clear">
															<IconButton
																size="large"
																onClick={() => {
																	setVerified(false)
																	setUsername('')
																}}
															>
																<IoClose size={48} color="grey" />
															</IconButton>
														</Tooltip>
													</Fade>
												)}
											</InputAdornment>
										),
									}}
									inputProps={{
										maxLength: 255,
										spellCheck: 'false',
									}}
								/>
							)}
						</TypewrittingInput>
					</Grid>
					<Grid
						item
						container
						justifyContent="center"
						alignItems="center"
						spacing={4}
						sx={{
							flexWrap: {
								xs: 'wrap',
								md: 'nowrap',
							},
						}}
					>
						<Grid item>
							{verified && available ? (
								<ClaimButton
									onClick={onClaim}
									fullWidth
									disabled={claiming || username.length === 0 || waitingForMetaMask}
									variant="contained"
									size="large"
								>
									{claiming && <CircularProgress color="inherit" size={32} sx={{ mr: 2 }} />}
									{waitingForMetaMask ? (
										<Fade in={waitingForMetaMask}>
											<img src={MetaMaskFoxLogo} alt="metamask-fox" style={{ height: '100%' }} />
										</Fade>
									) : claiming ? (
										'Claiming...'
									) : (
										'Claim'
									)}
								</ClaimButton>
							) : (
								<VerifyButton
									type="submit"
									onClick={() => (verified ? navigate(`/spaces/${username}/`) : onVerify())}
									fullWidth
									disabled={username.length === 0}
									variant="contained"
									endIcon={verified ? <Twemoji svg text="🔭👀" /> : <></>}
									size="large"
									sx={{
										fontSize: {
											xs: 18,
											sm: 24,
										},
									}}
								>
									{verified ? 'View space' : 'Check availability'}
								</VerifyButton>
							)}
						</Grid>

						{verified && costEstimate && available && (
							<>
								<Grid
									item
									sx={{
										height: '100%',
										display: {
											xs: 'none',
											md: 'flex',
										},
									}}
								>
									<Divider
										flexItem
										orientation="vertical"
										sx={{
											height: 60,
										}}
									/>
								</Grid>
								<Grid item container wrap="nowrap" spacing={4} alignItems="center" flexBasis="content">
									<Grid item>
										<Box
											position="relative"
											width={144}
											height={72}
											display="flex"
											alignItems="center"
											justifyContent="center"
											sx={{
												ml: 2,
												'&:before': {
													position: 'absolute',
													content: "''",
													background: 'linear-gradient(100deg,#aa039f,#ed014d,#f67916)',
													top: '50%',
													left: '50%',
													width: costEstimate ? '115%' : '100%',
													height: costEstimate ? '125%' : '100%',
													transform: 'translate3d(-50%,-50%,0)',
													filter: `blur(8px) ${!costEstimate ? 'grayscale(0.92) opacity(0.5)' : ''}`,
													transitionProperty: 'width, height, filter',
													transitionDuration: '0.2s',
													transitionTimingFunction: 'ease',
													borderRadius: 3,
													zIndex: 1,
												},
												'&:after': {
													content: "''",
													top: 0,
													right: 0,
													bottom: 0,
													left: 0,
													zIndex: 2,
													position: 'absolute',
													borderRadius: 3,
													backgroundColor: (theme) => theme.customPalette.customBackground,
												},
											}}
										>
											<Typography
												noWrap
												variant="h6"
												align="center"
												style={{
													zIndex: 3,
													marginTop: 4,
													fontSize: costEstimate ? '1.5rem' : 36,
													position: 'relative',
												}}
											>
												{new Intl.NumberFormat('en-US').format(costEstimate)}
											</Typography>
										</Box>
									</Grid>
									<Grid item>
										<Typography variant="h6" gutterBottom>
											Cost{' '}
											<Typography component="span" color="textSecondary">
												(SPC)
											</Typography>
										</Typography>
										<Typography variant="body2" color="textSecondary">
											The{' '}
											<Typography component="b" fontWeight={900} variant="body2" color="textPrimary">
												shorter
											</Typography>{' '}
											the username,
											<br />
											the{' '}
											<Typography component="b" fontWeight={900} variant="body2" color="textPrimary">
												more
											</Typography>{' '}
											it will cost to claim.
										</Typography>
									</Grid>
								</Grid>
							</>
						)}
					</Grid>
				</Grid>

				<Grow in={verified}>
					<div>
						{available ? (
							<Alert
								icon={
									<IoCheckmarkCircle style={{ position: 'relative', top: 2, color: theme.palette.success.light }} />
								}
								severity="success"
								sx={{ m: 'auto', mt: 4, mb: 0, maxWidth: 480, justifyContent: 'center' }}
							>
								<Typography>This space is available!</Typography>
							</Alert>
						) : (
							<Typography
								align="center"
								sx={{ m: 'auto', mt: 4, mb: 0, maxWidth: 860, display: 'block' }}
								gutterBottom
								color="error"
							>
								This space is already taken
							</Typography>
						)}
					</div>
				</Grow>
			</form>

			<Divider sx={{ my: 8 }} />

			<Typography variant="h4" gutterBottom align="center" component="p" fontFamily="DM Serif Display">
				Recent activity
			</Typography>

			<Table>
				<TableHead>
					<TableRow>
						<TableCell>
							<Typography fontFamily="DM Serif Display" variant="h6">
								Type
							</Typography>
						</TableCell>
						<TableCell>
							<Typography fontFamily="DM Serif Display" variant="h6">
								Space
							</Typography>
						</TableCell>
						<TableCell>
							<Typography fontFamily="DM Serif Display" variant="h6">
								Sender
							</Typography>
						</TableCell>
						<TableCell>
							<Typography fontFamily="DM Serif Display" variant="h6">
								To
							</Typography>
						</TableCell>
						<TableCell>
							<Typography fontFamily="DM Serif Display" variant="h6">
								Transaction ID
							</Typography>
						</TableCell>
						<TableCell>
							<Typography fontFamily="DM Serif Display" variant="h6">
								Time
							</Typography>
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{recentActivity?.map(
						({ timestamp, to, txId, sender, space, type }, i) =>
							i <= 10 && (
								<TableRow key={`${txId}-${i}`}>
									<TableCell>
										<Typography noWrap variant="body2">
											{type || '-'}
										</Typography>
									</TableCell>
									<TableCell>
										<Typography noWrap variant="body2">
											{space ? (
												<MuiLink component={Link} to={`/spaces/${space}/`}>
													{space}
												</MuiLink>
											) : (
												'-'
											)}
										</Typography>
									</TableCell>
									<TableCell>
										{sender ? <AddressChip address={sender} isObfuscated tooltipPlacement="top" /> : '-'}
									</TableCell>
									<TableCell>{to ? <AddressChip address={to} isObfuscated tooltipPlacement="top" /> : '-'}</TableCell>
									<TableCell>
										{txId ? (
											<AddressChip
												copyText="Copy TxID"
												copySuccessText="TxID copied!"
												address={txId}
												isObfuscated
												tooltipPlacement="top"
											/>
										) : (
											'-'
										)}
									</TableCell>
									<TableCell>
										<Typography noWrap variant="body2">
											{new Date(Number(timestamp) * 1000).toLocaleString() || '-'}
										</Typography>
									</TableCell>
								</TableRow>
							),
					)}
				</TableBody>
			</Table>

			<Box
				sx={{
					height: '30vh',
					minHeight: 220,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					mt: 8,
					borderRadius: 4,
					backgroundImage: `url(${ActivityBg})`,
					backgroundSize: 'cover',
					backgroundRepeat: 'no-repeat',
					backgroundPosition: 'center',
				}}
			>
				<ClaimButton
					onClick={() => {
						// @ts-ignore
						document.querySelector('#layout').scrollTo({ top: 0, left: 0, behavior: 'smooth' })
					}}
					variant="contained"
					size="large"
				>
					Claim your space
				</ClaimButton>
			</Box>
		</Page>
	)
})
