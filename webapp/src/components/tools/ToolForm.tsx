'use strict';

import * as API from '@api';
import ButtonSpinner from 'components/ButtonSpinner';
import CreateDatasourceModal from 'components/CreateDatasourceModal';
import DatasourcesSelect from 'components/datasources/DatasourcesSelect';
import ParameterForm from 'components/ParameterForm';
import RetrievalStrategyComponent from 'components/RetrievalStrategyComponent';
import Spinner from 'components/Spinner';
import FunctionRevisionForm from 'components/tools/form/FunctionRevisionForm';
import FunctionToolForm from 'components/tools/form/FunctionToolForm';
import ToolDetailsForm from 'components/tools/form/ToolDetailsForm';
import { useAccountContext } from 'context/account';
import { useSocketContext } from 'context/socket';
import { WrapToolCode } from 'function/base';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { usePostHog } from 'posthog-js/react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { runtimeOptions } from 'struct/function';
import { NotificationType } from 'struct/notification';
import { Retriever, Tool, ToolType } from 'struct/tool';

const tabs = [
	{ name: 'Datasource', href: '#datasource', toolTypes: [ToolType.RAG_TOOL] },
	{ name: 'Source', href: '#source', toolTypes: [ToolType.FUNCTION_TOOL] },
	{ name: 'Parameters', href: '#parameters', toolTypes: [ToolType.FUNCTION_TOOL] },
	{ name: 'Version History', href: '#version-history', toolTypes: [ToolType.FUNCTION_TOOL] }
];

function classNames(...classes) {
	return classes.filter(Boolean).join(' ');
}

export default function ToolForm({
	tool = {},
	revisions = [],
	datasources = [],
	editing,
	callback,
	compact,
	fetchFormData,
	initialType
}: {
	tool?: any;
	revisions?: any[];
	datasources?: any[];
	editing?: boolean;
	callback?: Function;
	compact?: boolean;
	fetchFormData?: Function;
	initialType?: ToolType;
}) {

	const [accountContext]: any = useAccountContext();
	const { csrf } = accountContext;
	const router = useRouter();
	const { resourceSlug } = router.query;
	const posthog = usePostHog();
	const [currentTab, setCurrentTab] = useState(tabs[0]);
	const isBuiltin = tool?.data?.builtin === true;
	const [toolCode, setToolCode] = useState(tool?.data?.code || '');
	const [wrappedCode, setWrappedCode] = useState(WrapToolCode(toolCode));
	const [requirementsTxt, setRequirementsTxt] = useState(tool?.data?.requirements || '');
	const [toolName, setToolName] = useState(tool?.name || tool?.data?.name || '');
	const [toolDescription, setToolDescription] = useState(
		tool?.data?.description || tool?.description || ''
	);
	const [requiredFields, setRequiredFields] = useState<Record<string, string>>({});
	const [toolType, setToolType] = useState((tool?.type as ToolType) || ToolType.RAG_TOOL);

	const [submitting, setSubmitting] = useState(false);
	const [style, setStyle] = useState(null);
	const [toolRetriever, setToolRetriever] = useState(tool?.retriever_type || Retriever.SELF_QUERY);
	const [topK, setTopK] = useState(tool?.retriever_config?.k || 3);
	const [toolDecayRate, setToolDecayRate] = useState<number | undefined>(
		tool?.retriever_config?.decay_rate || 0.5
	);
	const [toolTimeWeightField, setToolTimeWeightField] = useState(
		tool?.retriever_config?.timeWeightField || null
	);

	const [, notificationTrigger]: any = useSocketContext();

	useEffect(() => {
		if (notificationTrigger && notificationTrigger?.type === NotificationType.Tool) {
			fetchFormData();
		}
	}, [resourceSlug, notificationTrigger]);

	const codeBlockRef = useRef(null);
	useEffect(() => {
		setWrappedCode(WrapToolCode(toolCode));
	}, [toolCode]);
	const PreWithRef = preProps => {
		return <pre {...preProps} ref={codeBlockRef} />;
	};
	try {
		useEffect(() => {
			if (!style) {
				import('react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus').then(mod =>
					setStyle(mod.default)
				);
			}
		}, []);
	} catch (e) {
		console.error(e);
	}

	// TODO: move into RetrievalStrategyComponent, keep the setters passed as props
	useEffect(() => {
		if (toolRetriever !== Retriever.TIME_WEIGHTED) {
			setToolDecayRate(undefined);
		}
	}, [toolRetriever]);

	// Initial state setup for parameters and environment variables
	const initialFunctionParameters =
		tool?.data?.parameters?.properties &&
		Object.entries(tool.data.parameters.properties).reduce((acc, entry) => {
			const [parname, par]: any = entry;
			acc.push({
				name: parname,
				type: par.type,
				description: par.description,
				required: tool.data.parameters.required.includes(parname)
			});
			return acc;
		}, []);

	const initialEnvironmentVariables =
		tool?.data?.environmentVariables &&
		Object.entries(tool.data.environmentVariables).reduce((acc, entry) => {
			const [parname, par]: any = entry;
			acc.push({ name: parname, description: par });
			return acc;
		}, []);

	const initialParameters = tool?.parameters
		? Object.entries(tool.parameters).reduce((acc, entry) => {
				const [parname, par]: any = entry;
				acc.push({ name: parname, description: par });
				return acc;
			}, [])
		: tool?.requiredParameters &&
			Object.entries(tool?.requiredParameters.properties).reduce((acc, entry) => {
				const [parname, par]: any = entry;
				acc.push({ name: parname, description: '' });
				return acc;
			}, []);

	const [parameters, setParameters] = useState(
		initialParameters || [{ name: '', type: '', description: '', required: false }]
	);
	const [functionParameters, setFunctionParameters] = useState(
		initialFunctionParameters || [{ name: '', type: '', description: '', required: false }]
	);
	const [environmentVariables, setEnvironmentVariables] = useState(
		initialEnvironmentVariables || [{ name: '', description: '' }]
	);

	const initialDatasource = datasources.find(d => d._id === tool?.datasourceId);
	const [datasourceState, setDatasourceState]: any = useState(
		initialDatasource ? { label: initialDatasource.name, value: initialDatasource._id } : null
	);
	const currentDatasource = datasources.find(d => d._id === datasourceState?.value);

	const [runtimeState, setRuntimeState] = useState(tool?.data?.runtime || runtimeOptions[0].value);

	async function createDatasourceCallback(createdDatasource) {
		(await fetchFormData) && fetchFormData();
		setDatasourceState({ label: createdDatasource.name, value: createdDatasource.datasourceId });
		setModalOpen(false);
	}
	const [modalOpen, setModalOpen]: any = useState(false);

	async function toolPost(e) {
		e.preventDefault();
		setSubmitting(true); // Set submitting to true
		if (tool?.data?.required && tool.data.required.length > 0) {
			tool.data.required.forEach((field: string) => {
				if (!requiredFields[field] || requiredFields[field].length === 0) {
					toast.error(`The field ${field} is required but not present.`);
					return setSubmitting(false);
				}
			});
		}

		const posthogEvent = editing ? 'updateTool' : 'createTool';
		try {
			const body = {
				_csrf: e.target._csrf.value,
				resourceSlug,
				name: toolName,
				type: toolType,
				data: {
					...tool?.data,
					...requiredFields
				},
				schema: null,
				datasourceId: datasourceState ? datasourceState.value : null,
				description: toolDescription,
				retriever: toolRetriever,
				retriever_config: {
					...(tool?.retriever_config || {}),
					timeWeightField: toolTimeWeightField,
					decay_rate: toolDecayRate,
					k: topK
				} // TODO
			};
			switch (true) {
				case (tool?.data?.builtin === true):
					// TODO: anything? or nah
					break;
				case (toolType === ToolType.FUNCTION_TOOL):
					body.data = {
						...body.data,
						code: toolCode,
						requirements: requirementsTxt,
						runtime: runtimeState,
						description: toolDescription,
						environmentVariables: environmentVariables.reduce((acc, par) => {
							if (par.name.trim().length > 0) {
								acc[par.name.trim()] = par.description;
							}
							return acc;
						}, {}),
						parameters: {
							type: 'object',
							required: functionParameters.filter(x => x.required).map(x => x.name.trim()),
							properties: functionParameters.reduce((acc, par) => {
								acc[par.name.trim()] = {
									type: par.type,
									description: par.description
								};
								return acc;
							}, {})
						}
					};
					break;
				case (toolType === ToolType.RAG_TOOL):
					// TODO: anything? or nah
					break;
				default:
					return;
			}

			if (editing) {
				await API.editTool(
					{
						...body,
						toolId: tool._id
					},
					res => {
						posthog.capture(posthogEvent, {
							name: body.name,
							type: body.type,
							toolId: tool._id,
							revisionId: tool?.revisionId
						});
						if (toolType === ToolType.FUNCTION_TOOL && res?.functionNeedsUpdate === true) {
							toast.info('Tool updating...');
							router.push(`/${resourceSlug}/tools`);
						} else {
							toast.success('Tool updated sucessfully');
						}
					},
					err => {
						posthog.capture(posthogEvent, {
							name: body.name,
							type: body.type,
							toolId: tool._id,
							revisionId: tool?.revisionId,
							error: err
						});
						toast.error(err);
						setSubmitting(false);
					},
					compact ? null : router
				);
			} else {
				const addedTool = await API.addTool(
					body,
					() => {
						posthog.capture(posthogEvent, {
							name: body.name,
							type: body.type,
							toolId: tool._id,
							revisionId: tool?.revisionId
						});
						if (!compact) {
							if (toolType === ToolType.FUNCTION_TOOL) {
								toast.info('Tool deploying...');
							} else {
								toast.success('Tool created sucessfully');
							}
							router.push(`/${resourceSlug}/tools`);
						}
					},
					err => {
						posthog.capture(posthogEvent, {
							name: body.name,
							type: body.type,
							toolId: tool._id,
							revisionId: tool?.revisionId,
							error: err
						});
						toast.error(err);
					},
					compact ? null : router
				);
				callback && addedTool && callback(addedTool._id, body);
			}
		} finally {
			setSubmitting(false); // Set submitting to false
		}
	}

	useEffect(() => {
		const allowedTabs = tabs.filter(t => !t.toolTypes || t.toolTypes.includes(toolType));
		if (typeof window !== 'undefined') {
			const hashTab = window.location.hash;
			const foundTab = allowedTabs.find(t => t.href === hashTab);
			if (foundTab) {
				setCurrentTab(foundTab);
			} else {
				setCurrentTab(allowedTabs[0]);
			}
		}
	}, [toolType]);

	useEffect(() => {
		if (initialType) {
			setToolType(initialType);
		}
	}, [initialType]);

	let modal;
	switch (modalOpen) {
		case 'datasource':
			modal = (
				<CreateDatasourceModal
					open={modalOpen !== false}
					setOpen={setModalOpen}
					callback={createDatasourceCallback}
					initialStep={0}
				/>
			);
			break;
		default:
			modal = null;
			break;
	}

	if (tool === null) {
		return <Spinner />;
	}

	if (!style) {
		return null;
	}

	return (
		<>
			{modal}
			<form onSubmit={toolPost} className='flex flex-1 flex-col space-between'>
				<input type='hidden' name='_csrf' value={csrf} />
				<div className='space-y-12'>
					<div className='space-y-6'>
						<ToolDetailsForm
							toolName={toolName}
							setToolName={setToolName}
							toolType={toolType}
							setToolType={setToolType}
							toolDescription={toolDescription}
							setToolDescription={setToolDescription}
							isBuiltin={false}
							initialType={initialType}
						/>

						{tool?.data?.required && tool.data.required.length > 0 && (
							<div className='flex flex-col gap-y-1'>
								<label className='font-semibold text-gray-900 dark:text-gray-50 mb-2'>
									Required Fields:
								</label>
								{tool.data.required.map(field => (
									<div key={field} className='flex flex-col'>
										<label className='text-sm font-semibold text-gray-900 dark:text-gray-50 capitalize'>
											{field}
											<span className='text-red-500 ml-1'>*</span>
										</label>
										<input
											value={requiredFields[field] || ''}
											onChange={e => {
												setRequiredFields(prevState => ({
													...prevState,
													[field]: e.target.value
												}));
											}}
											type='text'
											className='w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-slate-800 dark:text-gray-50 mt-2'
										/>
									</div>
								))}
							</div>
						)}

						{!tool?.data?.builtin ? (
							<>
								<div>
									<div className='sm:hidden'>
										<label htmlFor='tabs' className='sr-only'>
											Select a tab
										</label>
										<select
											id='tabs'
											name='tabs'
											className='block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm'
											onChange={e => {
												setCurrentTab(tabs.find(t => t.name === e.target.value));
											}}
											defaultValue={currentTab.name}
										>
											{tabs
												.filter(tab => !tab.toolTypes || tab.toolTypes?.includes(toolType))
												.map(tab => (
													<option key={tab.name}>{tab.name}</option>
												))}
										</select>
									</div>
									<div className='hidden sm:block'>
										<div className='border-b border-gray-200'>
											<nav className='-mb-px flex space-x-8' aria-label='Tabs'>
												{tabs
													.filter(tab => !tab.toolTypes || tab.toolTypes?.includes(toolType))
													.map(tab => (
														<a
															key={tab.name}
															href={tab.href}
															onClick={e => {
																setCurrentTab(tabs.find(t => t.name === tab.name));
															}}
															className={classNames(
																currentTab.name === tab.name
																	? 'border-indigo-500 text-indigo-600'
																	: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
																'whitespace-nowrap border-b-2 px-2 py-4 text-sm font-medium flex'
															)}
															aria-current={currentTab.name === tab.name ? 'page' : undefined}
														>
															{tab.name}
															{tab.name === 'Version History' && tool?.functionLogs && (
																<svg
																	className='ms-2 h-2 w-2 fill-red-500'
																	viewBox='0 0 6 6'
																	aria-hidden='true'
																>
																	<circle cx='3' cy='3' r='3' />
																</svg>
															)}
														</a>
													))}
											</nav>
										</div>
									</div>
								</div>

								{toolType === ToolType.RAG_TOOL && currentTab?.name === 'Datasource' && (
									<>
										<div className='sm:col-span-12'>
											<DatasourcesSelect
												datasourceState={datasourceState}
												setDatasourceState={setDatasourceState}
												datasources={datasources}
												addNewCallback={setModalOpen}
											/>
											<RetrievalStrategyComponent
												toolRetriever={toolRetriever}
												setToolRetriever={setToolRetriever}
												toolDecayRate={toolDecayRate}
												setToolDecayRate={setToolDecayRate}
												toolTimeWeightField={toolTimeWeightField}
												setToolTimeWeightField={setToolTimeWeightField}
												metadataFieldInfo={tool.retriever_config?.metadata_field_info}
												currentDatasource={currentDatasource}
												topK={topK}
												setTopK={setTopK}
											/>
										</div>
									</>
								)}

								{toolType === ToolType.FUNCTION_TOOL &&
									!isBuiltin &&
									currentTab?.name === 'Source' && (
										<>
											<FunctionToolForm
												toolCode={toolCode}
												setToolCode={setToolCode}
												requirementsTxt={requirementsTxt}
												setRequirementsTxt={setRequirementsTxt}
												runtimeState={runtimeState}
												setRuntimeState={setRuntimeState}
												wrappedCode={wrappedCode}
												style={style}
												PreWithRef={PreWithRef}
												isBuiltin={false}
												runtimeOptions={runtimeOptions}
											/>
										</>
									)}

								{toolType === ToolType.FUNCTION_TOOL &&
									!isBuiltin &&
									currentTab?.name === 'Version History' && (
										<>
											<FunctionRevisionForm
												fetchFormData={fetchFormData}
												revisions={revisions}
												tool={tool}
											/>
										</>
									)}

								{toolType === ToolType.FUNCTION_TOOL && currentTab?.name === 'Parameters' && (
									<>
										<ParameterForm
											parameters={functionParameters}
											setParameters={setFunctionParameters}
											title='Parameters'
											disableTypes={false}
											hideRequired={false}
											namePlaceholder='Name'
											descriptionPlaceholder='Description'
										/>

										<ParameterForm
											parameters={environmentVariables}
											setParameters={setEnvironmentVariables}
											title='Environment Variables'
											disableTypes={true}
											hideRequired={true}
											namePattern='[A-Z][A-Z0-9_]*'
											namePlaceholder='Key must be uppercase seperated by underscores'
											descriptionPlaceholder='Value'
										/>
									</>
								)}
							</>
						) : (
							<>
								<ParameterForm
									readonlyKeys={true}
									parameters={parameters}
									setParameters={setParameters}
									title='Required Parameters'
									disableTypes={true}
									hideRequired={true}
									descriptionPlaceholder='Value'
								/>
							</>
						)}
					</div>
				</div>
				<div className='mt-auto pt-6 flex items-center justify-between gap-x-6'>
					{!compact && (
						<Link
							className='text-sm font-semibold leading-6 text-gray-900'
							href={`/${resourceSlug}/tools`}
						>
							Back
						</Link>
					)}
					<button
						type='submit'
						disabled={submitting}
						className={`flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${compact ? 'w-full' : ''}`}
					>
						{submitting && <ButtonSpinner className='mr-2' />}
						Save
					</button>
				</div>
			</form>
		</>
	);
}
