import {
	Body,
	Button,
	Column,
	Container,
	Font,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
} from '@react-email/components';
import * as React from 'react';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

interface InviteProps {
	name: string;
    inviteURL: string;
	teamName: string
}

const InviteEmail = ({ inviteURL, name, teamName }:InviteProps) => {
	return (
		<Html>
			<Head />
			<Preview>Agent Cloud Invitation</Preview>

			<Tailwind>
				<Font
					fontFamily='Inter'
					fontWeight={400}
					fontStyle='normal'
					webFont={{
						url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
						format: 'woff2',
					}}
					fallbackFontFamily='sans-serif'
				/>
				<Body className='bg-white text-gray-900 pt-8'>
					<Container className='p-5 mx-auto bg-gray-50'>
						<Section className='bg-white'>
							<Section className='py-5'>
								<Img
									src={`${process.env.URL_APP}/images/email/logo-light.png`}
									height='50'
									alt="AgentCloud's Logo"
									className='mx-auto'
								/>
							</Section>
							<Section className='p-6 text-center'>
								<Heading className='text-gray-800 font-bold text-xl mb-4 text-left'>Hi {name},</Heading>
								<Text className='text-gray-800 mb-4 text-left'>
									You have been invited to join {teamName} onAgentCloud.
									To accept the invitation and set up your account, please click the link below.
								</Text>

								<Button
									href={inviteURL}
									className='bg-indigo-700 text-white px-5 py-3 rounded-lg my-4'>Accept & Join Team</Button>
                            
								<Text className='text-gray-800 text-left'>
                                    Thank you,
									<br />
                                    AgentCloud Team
								</Text>
							</Section>
						</Section>
						<Section>
							<Row>
								<Column>
									<Text className='text-gray-500'>
                                        © 2024 RNA Digital
									</Text>
								</Column>

								<Column align='right'>
									<Link href='https://www.linkedin.com/company/rna-digital/'>
										<Img src='https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwww.iconsdb.com%2Ficons%2Fdownload%2Fgray%2Flinkedin-256.png&f=1&nofb=1&ipt=61200e7b12467a07c11d3c6fad21be349600ae4e27d3d4514d31c479cc6fe491&ipo=images'
											height={22}
											width={22}
											className='inline-block mt-auto mb-1'
										/> 
									</Link>

									<Link href='https://www.youtube.com/@monitapixels'>
										<Img src='https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Findrhi.gob.do%2Fwp-content%2Fuploads%2F2023%2F03%2Fyoutube-logo-icone-grise.png&f=1&nofb=1&ipt=2589ae724aec2691f533e086588642b031bddb1d4d0858d9c5ea17390ad738da&ipo=images'
											height={24}
											width={24}
											className='ml-2 inline-block'
										/>
									</Link>

									<Link href='https://github.com/rnadigital/agentcloud'>

										<Img src='https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ficones.pro%2Fwp-content%2Fuploads%2F2021%2F06%2Ficone-github-grise-300x300.png&f=1&nofb=1&ipt=277a25047eb9c146c0ebb3f7187a7c7090a45b379c72fd8bdd6c4660f128560e&ipo=images'
											height={24}
											width={24}
											className='ml-2 inline-block mt-auto'
										/>
									</Link>

								</Column>
							</Row>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default InviteEmail;
