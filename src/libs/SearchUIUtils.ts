import type {TextStyle, ViewStyle} from 'react-native';
import Onyx from 'react-native-onyx';
import type {OnyxCollection} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type {MenuItemWithLink} from '@components/MenuItemList';
import type {SearchColumnType, SearchQueryJSON, SearchStatus, SortOrder} from '@components/Search/types';
import ChatListItem from '@components/SelectionList/ChatListItem';
import ReportListItem from '@components/SelectionList/Search/ReportListItem';
import TaskListItem from '@components/SelectionList/Search/TaskListItem';
import TransactionListItem from '@components/SelectionList/Search/TransactionListItem';
import type {ListItem, ReportActionListItemType, ReportListItemType, SearchListItem, TaskListItemType, TransactionListItemType} from '@components/SelectionList/types';
import * as Expensicons from '@src/components/Icon/Expensicons';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {SaveSearchItem} from '@src/types/onyx/SaveSearch';
import type SearchResults from '@src/types/onyx/SearchResults';
import type {
    ListItemDataType,
    ListItemType,
    SearchDataTypes,
    SearchPersonalDetails,
    SearchPolicy,
    SearchReport,
    SearchTask,
    SearchTransaction,
    SearchTransactionAction,
} from '@src/types/onyx/SearchResults';
import type IconAsset from '@src/types/utils/IconAsset';
import {canApproveIOU, canIOUBePaid, canSubmitReport} from './actions/IOU';
import {convertToDisplayString} from './CurrencyUtils';
import DateUtils from './DateUtils';
import {formatPhoneNumber} from './LocalePhoneNumber';
import {translateLocal} from './Localize';
import Navigation from './Navigation/Navigation';
import Parser from './Parser';
import {getDisplayNameOrDefault} from './PersonalDetailsUtils';
import {canSendInvoice, getPolicy} from './PolicyUtils';
import {getOriginalMessage, isCreatedAction, isDeletedAction, isMoneyRequestAction, isResolvedActionableWhisper, isWhisperActionTargetedToOthers} from './ReportActionsUtils';
import {
    getIcons,
    getPersonalDetailsForAccountID,
    getReportName,
    getReportOrDraftReport,
    getSearchReportName,
    hasInvoiceReports,
    hasOnlyHeldExpenses,
    hasViolations,
    isAllowedToApproveExpenseReport as isAllowedToApproveExpenseReportUtils,
    isArchivedReport,
    isClosedReport,
    isInvoiceReport,
    isMoneyRequestReport,
    isOpenExpenseReport,
    isSettled,
} from './ReportUtils';
import {buildCannedSearchQuery} from './SearchQueryUtils';
import StringUtils from './StringUtils';
import {getAmount as getTransactionAmount, getCreated as getTransactionCreatedDate, getMerchant as getTransactionMerchant, isPendingCardOrScanningTransaction} from './TransactionUtils';
import shouldShowTransactionYear from './TransactionUtils/shouldShowTransactionYear';

const transactionColumnNamesToSortingProperty = {
    [CONST.SEARCH.TABLE_COLUMNS.TO]: 'formattedTo' as const,
    [CONST.SEARCH.TABLE_COLUMNS.FROM]: 'formattedFrom' as const,
    [CONST.SEARCH.TABLE_COLUMNS.DATE]: 'date' as const,
    [CONST.SEARCH.TABLE_COLUMNS.TAG]: 'tag' as const,
    [CONST.SEARCH.TABLE_COLUMNS.MERCHANT]: 'formattedMerchant' as const,
    [CONST.SEARCH.TABLE_COLUMNS.TOTAL_AMOUNT]: 'formattedTotal' as const,
    [CONST.SEARCH.TABLE_COLUMNS.CATEGORY]: 'category' as const,
    [CONST.SEARCH.TABLE_COLUMNS.TYPE]: 'transactionType' as const,
    [CONST.SEARCH.TABLE_COLUMNS.ACTION]: 'action' as const,
    [CONST.SEARCH.TABLE_COLUMNS.DESCRIPTION]: 'comment' as const,
    [CONST.SEARCH.TABLE_COLUMNS.TAX_AMOUNT]: null,
    [CONST.SEARCH.TABLE_COLUMNS.RECEIPT]: null,
    [CONST.SEARCH.TABLE_COLUMNS.IN]: 'parentReportID' as const,
};

const taskColumnNamesToSortingProperty = {
    [CONST.SEARCH.TABLE_COLUMNS.DATE]: 'created' as const,
    [CONST.SEARCH.TABLE_COLUMNS.DESCRIPTION]: 'description' as const,
    [CONST.SEARCH.TABLE_COLUMNS.TITLE]: 'reportName' as const,
    [CONST.SEARCH.TABLE_COLUMNS.CREATED_BY]: 'formattedCreatedBy' as const,
    [CONST.SEARCH.TABLE_COLUMNS.ASSIGNEE]: 'formattedAssignee' as const,
    [CONST.SEARCH.TABLE_COLUMNS.IN]: 'parentReportID' as const,
};

let currentAccountID: number | undefined;
Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (session) => {
        currentAccountID = session?.accountID;
    },
});

const emptyPersonalDetails = {
    accountID: CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
    avatar: '',
    displayName: undefined,
    login: undefined,
};

type ReportKey = `${typeof ONYXKEYS.COLLECTION.REPORT}${string}`;

type TransactionKey = `${typeof ONYXKEYS.COLLECTION.TRANSACTION}${string}`;

type ReportActionKey = `${typeof ONYXKEYS.COLLECTION.REPORT_ACTIONS}${string}`;

type PolicyKey = `${typeof ONYXKEYS.COLLECTION.POLICY}${string}`;
type ViolationKey = `${typeof ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${string}`;

type SavedSearchMenuItem = MenuItemWithLink & {
    key: string;
    hash: string;
    query: string;
    styles?: Array<ViewStyle | TextStyle>;
};

type SearchTypeMenuItem = {
    translationPath: TranslationPaths;
    type: SearchDataTypes;
    icon: IconAsset;
    getRoute: (policyID?: string) => Route;
};

/**
 * @private
 *
 * Returns a list of properties that are common to every Search ListItem
 */
function getTransactionItemCommonFormattedProperties(
    transactionItem: SearchTransaction,
    from: SearchPersonalDetails,
    to: SearchPersonalDetails,
    policy: SearchPolicy,
): Pick<TransactionListItemType, 'formattedFrom' | 'formattedTo' | 'formattedTotal' | 'formattedMerchant' | 'date'> {
    const isExpenseReport = transactionItem.reportType === CONST.REPORT.TYPE.EXPENSE;

    const formattedFrom = formatPhoneNumber(getDisplayNameOrDefault(from));
    // Sometimes the search data personal detail for the 'to' account might not hold neither the display name nor the login
    // so for those cases we fallback to the display name of the personal detail data from onyx.
    const formattedTo = formatPhoneNumber(getDisplayNameOrDefault(to, '', false) || getDisplayNameOrDefault(getPersonalDetailsForAccountID(to?.accountID)));
    const formattedTotal = getTransactionAmount(transactionItem, isExpenseReport);
    const date = transactionItem?.modifiedCreated ? transactionItem.modifiedCreated : transactionItem?.created;
    const merchant = getTransactionMerchant(transactionItem, policy as OnyxTypes.Policy);
    const formattedMerchant = merchant === CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT ? '' : merchant;

    return {
        formattedFrom,
        formattedTo,
        date,
        formattedTotal,
        formattedMerchant,
    };
}

/**
 * @private
 */
function isReportEntry(key: string): key is ReportKey {
    return key.startsWith(ONYXKEYS.COLLECTION.REPORT);
}

/**
 * @private
 */
function isTransactionEntry(key: string): key is TransactionKey {
    return key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION);
}

/**
 * @private
 */
function isPolicyEntry(key: string): key is PolicyKey {
    return key.startsWith(ONYXKEYS.COLLECTION.POLICY);
}

function isViolationEntry(key: string): key is ViolationKey {
    return key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
}

/**
 * @private
 */
function isReportActionEntry(key: string): key is ReportActionKey {
    return key.startsWith(ONYXKEYS.COLLECTION.REPORT_ACTIONS);
}

/**
 * Determines whether to display the merchant field based on the transactions in the search results.
 */
function getShouldShowMerchant(data: OnyxTypes.SearchResults['data']): boolean {
    return Object.keys(data).some((key) => {
        if (isTransactionEntry(key)) {
            const item = data[key];
            const merchant = item.modifiedMerchant ? item.modifiedMerchant : item.merchant ?? '';
            return merchant !== '' && merchant !== CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT;
        }
        return false;
    });
}

/**
 * Type guard that checks if something is a ReportListItemType
 */
function isReportListItemType(item: ListItem): item is ReportListItemType {
    return 'transactions' in item;
}

/**
 * Type guard that checks if something is a TransactionListItemType
 */
function isTransactionListItemType(item: SearchListItem): item is TransactionListItemType {
    const transactionListItem = item as TransactionListItemType;
    return transactionListItem.transactionID !== undefined;
}

/**
 * Type guard that check if something is a TaskListItemType
 */
function isTaskListItemType(item: SearchListItem): item is TaskListItemType {
    return 'type' in item && item.type === CONST.REPORT.TYPE.TASK;
}

/**
 * Type guard that checks if something is a ReportActionListItemType
 */
function isReportActionListItemType(item: SearchListItem): item is ReportActionListItemType {
    const reportActionListItem = item as ReportActionListItemType;
    return reportActionListItem.reportActionID !== undefined;
}

/**
 * Checks if the date of transactions or reports indicate the need to display the year because they are from a past year.
 */
function shouldShowYear(data: TransactionListItemType[] | ReportListItemType[] | TaskListItemType[] | OnyxTypes.SearchResults['data']) {
    const currentYear = new Date().getFullYear();

    if (Array.isArray(data)) {
        return data.some((item: TransactionListItemType | ReportListItemType | TaskListItemType) => {
            if (isTaskListItemType(item)) {
                const taskYear = new Date(item.created).getFullYear();
                return taskYear !== currentYear;
            }

            if (isReportListItemType(item)) {
                // If the item is a ReportListItemType, iterate over its transactions and check them
                return item.transactions.some((transaction) => {
                    const transactionYear = new Date(getTransactionCreatedDate(transaction)).getFullYear();
                    return transactionYear !== currentYear;
                });
            }

            const createdYear = new Date(item?.modifiedCreated ? item.modifiedCreated : item?.created || '').getFullYear();
            return createdYear !== currentYear;
        });
    }

    for (const key in data) {
        if (isTransactionEntry(key)) {
            const item = data[key];
            if (shouldShowTransactionYear(item)) {
                return true;
            }
        } else if (isReportActionEntry(key)) {
            const item = data[key];
            for (const action of Object.values(item)) {
                const date = action.created;

                if (DateUtils.doesDateBelongToAPastYear(date)) {
                    return true;
                }
            }
        } else if (isReportEntry(key)) {
            const item = data[key];
            const date = item.created;

            if (date && DateUtils.doesDateBelongToAPastYear(date)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * @private
 * Generates a display name for IOU reports considering the personal details of the payer and the transaction details.
 */
function getIOUReportName(data: OnyxTypes.SearchResults['data'], reportItem: SearchReport) {
    const payerPersonalDetails = reportItem.managerID ? data.personalDetailsList?.[reportItem.managerID] : emptyPersonalDetails;
    // For cases where the data personal detail for manager ID do not exist in search data.personalDetailsList
    // we fallback to the display name of the personal detail data from onyx.
    const payerName = payerPersonalDetails?.displayName ?? payerPersonalDetails?.login ?? getDisplayNameOrDefault(getPersonalDetailsForAccountID(reportItem.managerID));
    const formattedAmount = convertToDisplayString(reportItem.total ?? 0, reportItem.currency ?? CONST.CURRENCY.USD);
    if (reportItem.action === CONST.SEARCH.ACTION_TYPES.PAID) {
        return translateLocal('iou.payerPaidAmount', {
            payer: payerName,
            amount: formattedAmount,
        });
    }

    return translateLocal('iou.payerOwesAmount', {
        payer: payerName,
        amount: formattedAmount,
    });
}

/**
 * @private
 * Organizes data into List Sections for display, for the TransactionListItemType of Search Results.
 *
 * Do not use directly, use only via `getSections()` facade.
 */
function getTransactionsSections(data: OnyxTypes.SearchResults['data'], metadata: OnyxTypes.SearchResults['search']): TransactionListItemType[] {
    const shouldShowMerchant = getShouldShowMerchant(data);
    const doesDataContainAPastYearTransaction = shouldShowYear(data);

    return Object.keys(data)
        .filter(isTransactionEntry)
        .map((key) => {
            const transactionItem = data[key];
            const report = data[`${ONYXKEYS.COLLECTION.REPORT}${transactionItem.reportID}`];
            const shouldShowBlankTo = isOpenExpenseReport(report);
            const policy = data[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
            const from = data.personalDetailsList?.[transactionItem.accountID];
            const to = transactionItem.managerID && !shouldShowBlankTo ? data.personalDetailsList?.[transactionItem.managerID] ?? emptyPersonalDetails : emptyPersonalDetails;

            const {formattedFrom, formattedTo, formattedTotal, formattedMerchant, date} = getTransactionItemCommonFormattedProperties(transactionItem, from, to, policy);

            return {
                ...transactionItem,
                action: getAction(data, key),
                from,
                to,
                formattedFrom,
                formattedTo: shouldShowBlankTo ? '' : formattedTo,
                formattedTotal,
                formattedMerchant,
                date,
                shouldShowMerchant,
                shouldShowCategory: metadata?.columnsToShow?.shouldShowCategoryColumn,
                shouldShowTag: metadata?.columnsToShow?.shouldShowTagColumn,
                shouldShowTax: metadata?.columnsToShow?.shouldShowTaxColumn,
                keyForList: transactionItem.transactionID,
                shouldShowYear: doesDataContainAPastYearTransaction,
            };
        });
}

/**
 * Returns the action that can be taken on a given transaction or report
 *
 * Do not use directly, use only via `getSections()` facade.
 */
function getAction(data: OnyxTypes.SearchResults['data'], key: string): SearchTransactionAction {
    const isTransaction = isTransactionEntry(key);
    if (!isTransaction && !isReportEntry(key)) {
        return CONST.SEARCH.ACTION_TYPES.VIEW;
    }

    const transaction = isTransaction ? data[key] : undefined;
    const report = isTransaction ? data[`${ONYXKEYS.COLLECTION.REPORT}${transaction?.reportID}`] : data[key];

    // Tracked and unreported expenses don't have a report, so we return early.
    if (!report) {
        return CONST.SEARCH.ACTION_TYPES.VIEW;
    }

    if (isSettled(report)) {
        return CONST.SEARCH.ACTION_TYPES.PAID;
    }

    if (isClosedReport(report)) {
        return CONST.SEARCH.ACTION_TYPES.DONE;
    }

    // We need to check both options for a falsy value since the transaction might not have an error but the report associated with it might. We return early if there are any errors for performance reasons, so we don't need to compute any other possible actions.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (transaction?.errors || report?.errors) {
        return CONST.SEARCH.ACTION_TYPES.REVIEW;
    }

    // We don't need to run the logic if this is not a transaction or iou/expense report, so let's shortcut the logic for performance reasons
    if (!isMoneyRequestReport(report)) {
        return CONST.SEARCH.ACTION_TYPES.VIEW;
    }

    const allReportTransactions = (
        isReportEntry(key)
            ? Object.entries(data)
                  .filter(([itemKey, value]) => isTransactionEntry(itemKey) && (value as SearchTransaction)?.reportID === report.reportID)
                  .map((item) => item[1])
            : [transaction]
    ) as SearchTransaction[];

    const allViolations = Object.fromEntries(Object.entries(data).filter(([itemKey]) => isViolationEntry(itemKey))) as OnyxCollection<OnyxTypes.TransactionViolation[]>;
    const policy = data[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`] ?? {};
    const isSubmitter = report.ownerAccountID === currentAccountID;
    const isAdmin = policy.role === CONST.POLICY.ROLE.ADMIN;
    const isApprover = report.managerID === currentAccountID;
    const shouldShowReview = hasViolations(report.reportID, allViolations, undefined, allReportTransactions) && (isSubmitter || isApprover || isAdmin);

    if (shouldShowReview) {
        return CONST.SEARCH.ACTION_TYPES.REVIEW;
    }

    // Submit/Approve/Pay can only be taken on transactions if the transaction is the only one on the report, otherwise `View` is the only option.
    // If this condition is not met, return early for performance reasons
    if (isTransaction && !data[key].isFromOneTransactionReport) {
        return CONST.SEARCH.ACTION_TYPES.VIEW;
    }

    const invoiceReceiverPolicy =
        isInvoiceReport(report) && report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.BUSINESS
            ? data[`${ONYXKEYS.COLLECTION.POLICY}${report?.invoiceReceiver?.policyID}`]
            : undefined;

    const chatReport = data[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`] ?? {};
    const chatReportRNVP = data[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.chatReportID}`] ?? undefined;

    if (canIOUBePaid(report, chatReport, policy, allReportTransactions, false, chatReportRNVP, invoiceReceiverPolicy) && !hasOnlyHeldExpenses(report.reportID, allReportTransactions)) {
        return CONST.SEARCH.ACTION_TYPES.PAY;
    }
    const hasOnlyPendingCardOrScanningTransactions = allReportTransactions.length > 0 && allReportTransactions.every(isPendingCardOrScanningTransaction);

    const isAllowedToApproveExpenseReport = isAllowedToApproveExpenseReportUtils(report, undefined, policy);
    if (canApproveIOU(report, policy) && isAllowedToApproveExpenseReport && !hasOnlyPendingCardOrScanningTransactions) {
        return CONST.SEARCH.ACTION_TYPES.APPROVE;
    }

    const reportNVP = data[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID}`] ?? undefined;
    const isArchived = isArchivedReport(reportNVP);

    // We check for isAllowedToApproveExpenseReport because if the policy has preventSelfApprovals enabled, we disable the Submit action and in that case we want to show the View action instead
    if (canSubmitReport(report, policy, allReportTransactions, allViolations, isArchived) && isAllowedToApproveExpenseReport) {
        return CONST.SEARCH.ACTION_TYPES.SUBMIT;
    }

    if (reportNVP?.exportFailedTime) {
        return CONST.SEARCH.ACTION_TYPES.REVIEW;
    }

    return CONST.SEARCH.ACTION_TYPES.VIEW;
}

/**
 * @private
 * Organizes data into List Sections for display, for the TaskListItemType of Search Results.
 *
 * Do not use directly, use only via `getSections()` facade.
 */
function getTaskSections(data: OnyxTypes.SearchResults['data']): TaskListItemType[] {
    return (
        Object.keys(data)
            .filter(isReportEntry)
            // Ensure that the reports that were passed are tasks, and not some other
            // type of report that was sent as the parent
            .filter((key) => isTaskListItemType(data[key] as SearchListItem))
            .map((key) => {
                const taskItem = data[key] as SearchTask;
                const personalDetails = data.personalDetailsList;

                const assignee = personalDetails?.[taskItem.managerID] ?? emptyPersonalDetails;
                const createdBy = personalDetails?.[taskItem.accountID] ?? emptyPersonalDetails;
                const formattedAssignee = formatPhoneNumber(getDisplayNameOrDefault(assignee));
                const formattedCreatedBy = formatPhoneNumber(getDisplayNameOrDefault(createdBy));

                const report = getReportOrDraftReport(taskItem.reportID) ?? taskItem;
                const parentReport = getReportOrDraftReport(taskItem.parentReportID);

                const doesDataContainAPastYearTransaction = shouldShowYear(data);
                const reportName = StringUtils.lineBreaksToSpaces(Parser.htmlToText(taskItem.reportName));
                const description = StringUtils.lineBreaksToSpaces(Parser.htmlToText(taskItem.description));

                const result: TaskListItemType = {
                    ...taskItem,
                    reportName,
                    description,
                    assignee,
                    formattedAssignee,
                    createdBy,
                    formattedCreatedBy,
                    keyForList: taskItem.reportID,
                    shouldShowYear: doesDataContainAPastYearTransaction,
                };

                if (parentReport && personalDetails) {
                    const policy = getPolicy(parentReport.policyID);
                    const parentReportName = getReportName(parentReport, policy, undefined, undefined);
                    const icons = getIcons(parentReport, personalDetails, null, '', -1, policy);
                    const parentReportIcon = icons?.at(0);

                    result.parentReportName = parentReportName;
                    result.parentReportIcon = parentReportIcon;
                }

                if (report) {
                    result.report = report;
                }

                return result;
            })
    );
}

/**
 * @private
 * Organizes data into List Sections for display, for the ReportActionListItemType of Search Results.
 *
 * Do not use directly, use only via `getSections()` facade.
 */
function getReportActionsSections(data: OnyxTypes.SearchResults['data']): ReportActionListItemType[] {
    const reportActionItems: ReportActionListItemType[] = [];

    const transactions = Object.keys(data)
        .filter(isTransactionEntry)
        .map((key) => data[key]);

    const reports = Object.keys(data)
        .filter(isReportEntry)
        .map((key) => data[key]);

    const policies = Object.keys(data)
        .filter(isPolicyEntry)
        .map((key) => data[key]);

    for (const key in data) {
        if (isReportActionEntry(key)) {
            const reportActions = data[key];
            for (const reportAction of Object.values(reportActions)) {
                const from = data.personalDetailsList?.[reportAction.accountID];
                const report = data[`${ONYXKEYS.COLLECTION.REPORT}${reportAction.reportID}`] ?? {};
                const policy = data[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`] ?? {};
                const originalMessage = isMoneyRequestAction(reportAction) ? getOriginalMessage<typeof CONST.REPORT.ACTIONS.TYPE.IOU>(reportAction) : undefined;
                const isSendingMoney = isMoneyRequestAction(reportAction) && originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.PAY && originalMessage?.IOUDetails;

                const invoiceReceiverPolicy: SearchPolicy | undefined =
                    report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.BUSINESS ? data[`${ONYXKEYS.COLLECTION.POLICY}${report.invoiceReceiver.policyID}`] : undefined;
                if (
                    isDeletedAction(reportAction) ||
                    isResolvedActionableWhisper(reportAction) ||
                    reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.CLOSED ||
                    isCreatedAction(reportAction) ||
                    isWhisperActionTargetedToOthers(reportAction) ||
                    (isMoneyRequestAction(reportAction) && !!report?.isWaitingOnBankAccount && originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.PAY && !isSendingMoney)
                ) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                reportActionItems.push({
                    ...reportAction,
                    from,
                    reportName: getSearchReportName({report, policy, personalDetails: data.personalDetailsList, transactions, invoiceReceiverPolicy, reports, policies}),
                    formattedFrom: from?.displayName ?? from?.login ?? '',
                    date: reportAction.created,
                    keyForList: reportAction.reportActionID,
                });
            }
        }
    }
    return reportActionItems;
}

/**
 * @private
 * Organizes data into List Sections for display, for the ReportListItemType of Search Results.
 *
 * Do not use directly, use only via `getSections()` facade.
 */
function getReportSections(data: OnyxTypes.SearchResults['data'], metadata: OnyxTypes.SearchResults['search']): ReportListItemType[] {
    const shouldShowMerchant = getShouldShowMerchant(data);

    const doesDataContainAPastYearTransaction = shouldShowYear(data);

    const reportIDToTransactions: Record<string, ReportListItemType> = {};
    for (const key in data) {
        if (isReportEntry(key) && (data[key].type === CONST.REPORT.TYPE.IOU || data[key].type === CONST.REPORT.TYPE.EXPENSE || data[key].type === CONST.REPORT.TYPE.INVOICE)) {
            const reportItem = {...data[key]};
            const reportKey = `${ONYXKEYS.COLLECTION.REPORT}${reportItem.reportID}`;
            const transactions = reportIDToTransactions[reportKey]?.transactions ?? [];
            const isIOUReport = reportItem.type === CONST.REPORT.TYPE.IOU;

            reportIDToTransactions[reportKey] = {
                ...reportItem,
                action: getAction(data, key),
                keyForList: reportItem.reportID,
                from: data.personalDetailsList?.[reportItem.accountID ?? CONST.DEFAULT_NUMBER_ID],
                to: reportItem.managerID ? data.personalDetailsList?.[reportItem.managerID] : emptyPersonalDetails,
                transactions,
            };

            if (isIOUReport) {
                reportIDToTransactions[reportKey].reportName = getIOUReportName(data, reportIDToTransactions[reportKey]);
            }
        } else if (isTransactionEntry(key)) {
            const transactionItem = {...data[key]};
            const reportKey = `${ONYXKEYS.COLLECTION.REPORT}${transactionItem.reportID}`;
            const report = data[`${ONYXKEYS.COLLECTION.REPORT}${transactionItem.reportID}`];
            const policy = data[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
            const shouldShowBlankTo = isOpenExpenseReport(report);

            const from = data.personalDetailsList?.[transactionItem.accountID];
            const to = transactionItem.managerID && !shouldShowBlankTo ? data.personalDetailsList?.[transactionItem.managerID] ?? emptyPersonalDetails : emptyPersonalDetails;

            const {formattedFrom, formattedTo, formattedTotal, formattedMerchant, date} = getTransactionItemCommonFormattedProperties(transactionItem, from, to, policy);

            const transaction = {
                ...transactionItem,
                action: getAction(data, key),
                from,
                to,
                formattedFrom,
                formattedTo: shouldShowBlankTo ? '' : formattedTo,
                formattedTotal,
                formattedMerchant,
                date,
                shouldShowMerchant,
                shouldShowCategory: metadata?.columnsToShow?.shouldShowCategoryColumn,
                shouldShowTag: metadata?.columnsToShow?.shouldShowTagColumn,
                shouldShowTax: metadata?.columnsToShow?.shouldShowTaxColumn,
                keyForList: transactionItem.transactionID,
                shouldShowYear: doesDataContainAPastYearTransaction,
            };
            if (reportIDToTransactions[reportKey]?.transactions) {
                reportIDToTransactions[reportKey].transactions.push(transaction);
            } else if (reportIDToTransactions[reportKey]) {
                reportIDToTransactions[reportKey].transactions = [transaction];
            }
        }
    }

    return Object.values(reportIDToTransactions);
}

/**
 * Returns the appropriate list item component based on the type and status of the search data.
 */
function getListItem(type: SearchDataTypes, status: SearchStatus, shouldGroupByReports = false): ListItemType<typeof type, typeof status> {
    if (type === CONST.SEARCH.DATA_TYPES.CHAT) {
        return ChatListItem;
    }
    if (type === CONST.SEARCH.DATA_TYPES.TASK) {
        return TaskListItem;
    }
    if (!shouldGroupByReports) {
        return TransactionListItem;
    }
    return ReportListItem;
}

/**
 * Organizes data into appropriate list sections for display based on the type of search results.
 */
function getSections(type: SearchDataTypes, status: SearchStatus, data: OnyxTypes.SearchResults['data'], metadata: OnyxTypes.SearchResults['search'], shouldGroupByReports = false) {
    if (type === CONST.SEARCH.DATA_TYPES.CHAT) {
        return getReportActionsSections(data);
    }
    if (type === CONST.SEARCH.DATA_TYPES.TASK) {
        return getTaskSections(data);
    }
    if (!shouldGroupByReports) {
        return getTransactionsSections(data, metadata);
    }

    return getReportSections(data, metadata);
}

/**
 * Sorts sections of data based on a specified column and sort order for displaying sorted results.
 */
function getSortedSections(
    type: SearchDataTypes,
    status: SearchStatus,
    data: ListItemDataType<typeof type, typeof status>,
    sortBy?: SearchColumnType,
    sortOrder?: SortOrder,
    shouldGroupByReports = false,
) {
    if (type === CONST.SEARCH.DATA_TYPES.CHAT) {
        return getSortedReportActionData(data as ReportActionListItemType[]);
    }
    if (type === CONST.SEARCH.DATA_TYPES.TASK) {
        return getSortedTaskData(data as TaskListItemType[], sortBy, sortOrder);
    }
    if (!shouldGroupByReports) {
        return getSortedTransactionData(data as TransactionListItemType[], sortBy, sortOrder);
    }
    return getSortedReportData(data as ReportListItemType[]);
}

/**
 * Compares two values based on a specified sorting order and column.
 * Handles both string and numeric comparisons, with special handling for absolute values when sorting by total amount.
 */
function compareValues(a: unknown, b: unknown, sortOrder: SortOrder, sortBy: string): number {
    const isAsc = sortOrder === CONST.SEARCH.SORT_ORDER.ASC;

    if (a === undefined || b === undefined) {
        return 0;
    }

    if (typeof a === 'string' && typeof b === 'string') {
        return isAsc ? a.localeCompare(b) : b.localeCompare(a);
    }

    if (typeof a === 'number' && typeof b === 'number') {
        const aValue = sortBy === CONST.SEARCH.TABLE_COLUMNS.TOTAL_AMOUNT ? Math.abs(a) : a;
        const bValue = sortBy === CONST.SEARCH.TABLE_COLUMNS.TOTAL_AMOUNT ? Math.abs(b) : b;
        return isAsc ? aValue - bValue : bValue - aValue;
    }

    return 0;
}

/**
 * @private
 * Sorts transaction sections based on a specified column and sort order.
 */
function getSortedTransactionData(data: TransactionListItemType[], sortBy?: SearchColumnType, sortOrder?: SortOrder) {
    if (!sortBy || !sortOrder) {
        return data;
    }

    const sortingProperty = transactionColumnNamesToSortingProperty[sortBy as keyof typeof transactionColumnNamesToSortingProperty];

    if (!sortingProperty) {
        return data;
    }

    return data.sort((a, b) => {
        const aValue = sortingProperty === 'comment' ? a.comment?.comment : a[sortingProperty as keyof TransactionListItemType];
        const bValue = sortingProperty === 'comment' ? b.comment?.comment : b[sortingProperty as keyof TransactionListItemType];

        return compareValues(aValue, bValue, sortOrder, sortingProperty);
    });
}

function getSortedTaskData(data: TaskListItemType[], sortBy?: SearchColumnType, sortOrder?: SortOrder) {
    if (!sortBy || !sortOrder) {
        return data;
    }

    const sortingProperty = taskColumnNamesToSortingProperty[sortBy as keyof typeof taskColumnNamesToSortingProperty];

    if (!sortingProperty) {
        return data;
    }

    return data.sort((a, b) => {
        const aValue = a[sortingProperty as keyof TaskListItemType];
        const bValue = b[sortingProperty as keyof TaskListItemType];

        return compareValues(aValue, bValue, sortOrder, sortingProperty);
    });
}

/**
 * @private
 * Sorts report sections based on a specified column and sort order.
 */
function getSortedReportData(data: ReportListItemType[]) {
    for (const report of data) {
        report.transactions = getSortedTransactionData(report.transactions, CONST.SEARCH.TABLE_COLUMNS.DATE, CONST.SEARCH.SORT_ORDER.DESC);
    }
    return data.sort((a, b) => {
        const aNewestTransaction = a.transactions?.at(0)?.modifiedCreated ? a.transactions?.at(0)?.modifiedCreated : a.transactions?.at(0)?.created;
        const bNewestTransaction = b.transactions?.at(0)?.modifiedCreated ? b.transactions?.at(0)?.modifiedCreated : b.transactions?.at(0)?.created;

        if (!aNewestTransaction || !bNewestTransaction) {
            return 0;
        }

        return bNewestTransaction.toLowerCase().localeCompare(aNewestTransaction);
    });
}

/**
 * @private
 * Sorts report actions sections based on a specified column and sort order.
 */
function getSortedReportActionData(data: ReportActionListItemType[]) {
    return data.sort((a, b) => {
        const aValue = a?.created;
        const bValue = b?.created;

        if (aValue === undefined || bValue === undefined) {
            return 0;
        }

        return bValue.toLowerCase().localeCompare(aValue);
    });
}

/**
 * Checks if the search results contain any data, useful for determining if the search results are empty.
 */
function isSearchResultsEmpty(searchResults: SearchResults) {
    return !Object.keys(searchResults?.data).some((key) => key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION));
}

/**
 * Returns the corresponding translation key for expense type
 */
function getExpenseTypeTranslationKey(expenseType: ValueOf<typeof CONST.SEARCH.TRANSACTION_TYPE>): TranslationPaths {
    // eslint-disable-next-line default-case
    switch (expenseType) {
        case CONST.SEARCH.TRANSACTION_TYPE.DISTANCE:
            return 'common.distance';
        case CONST.SEARCH.TRANSACTION_TYPE.CARD:
            return 'common.card';
        case CONST.SEARCH.TRANSACTION_TYPE.CASH:
            return 'iou.cash';
        case CONST.SEARCH.TRANSACTION_TYPE.PER_DIEM:
            return 'common.perDiem';
    }
}

/**
 * Constructs and configures the overflow menu for search items, handling interactions such as renaming or deleting items.
 */
function getOverflowMenu(itemName: string, hash: number, inputQuery: string, showDeleteModal: (hash: number) => void, isMobileMenu?: boolean, closeMenu?: () => void) {
    return [
        {
            text: translateLocal('common.rename'),
            onSelected: () => {
                if (isMobileMenu && closeMenu) {
                    closeMenu();
                }
                Navigation.navigate(ROUTES.SEARCH_SAVED_SEARCH_RENAME.getRoute({name: encodeURIComponent(itemName), jsonQuery: inputQuery}));
            },
            icon: Expensicons.Pencil,
            shouldShowRightIcon: false,
            shouldShowRightComponent: false,
            shouldCallAfterModalHide: true,
        },
        {
            text: translateLocal('common.delete'),
            onSelected: () => {
                if (isMobileMenu && closeMenu) {
                    closeMenu();
                }
                showDeleteModal(hash);
            },
            icon: Expensicons.Trashcan,
            shouldShowRightIcon: false,
            shouldShowRightComponent: false,
            shouldCallAfterModalHide: true,
            shouldCloseAllModals: true,
        },
    ];
}

/**
 * Checks if the passed username is a correct standard username, and not a placeholder
 */
function isCorrectSearchUserName(displayName?: string) {
    return displayName && displayName.toUpperCase() !== CONST.REPORT.OWNER_EMAIL_FAKE;
}

function createTypeMenuItems(allPolicies: OnyxCollection<OnyxTypes.Policy> | null, email: string | undefined): SearchTypeMenuItem[] {
    const typeMenuItems: SearchTypeMenuItem[] = [
        {
            translationPath: 'common.expenses',
            type: CONST.SEARCH.DATA_TYPES.EXPENSE,
            icon: Expensicons.Receipt,
            getRoute: (policyID?: string) => {
                const query = buildCannedSearchQuery({policyID});
                return ROUTES.SEARCH_ROOT.getRoute({query});
            },
        },
        {
            translationPath: 'common.expenseReports',
            type: CONST.SEARCH.DATA_TYPES.EXPENSE,
            icon: Expensicons.Document,
            getRoute: (policyID?: string) => {
                const query = buildCannedSearchQuery({groupBy: CONST.SEARCH.GROUP_BY.REPORTS, policyID});
                return ROUTES.SEARCH_ROOT.getRoute({query});
            },
        },
        {
            translationPath: 'common.chats',
            type: CONST.SEARCH.DATA_TYPES.CHAT,
            icon: Expensicons.ChatBubbles,
            getRoute: (policyID?: string) => {
                const query = buildCannedSearchQuery({type: CONST.SEARCH.DATA_TYPES.CHAT, status: CONST.SEARCH.STATUS.CHAT.ALL, policyID});
                return ROUTES.SEARCH_ROOT.getRoute({query});
            },
        },
        {
            translationPath: 'common.tasks',
            type: CONST.SEARCH.DATA_TYPES.TASK,
            icon: Expensicons.Task,
            getRoute: (policyID?: string) => {
                const query = buildCannedSearchQuery({type: CONST.SEARCH.DATA_TYPES.TASK, status: CONST.SEARCH.STATUS.TASK.ALL, policyID});
                return ROUTES.SEARCH_ROOT.getRoute({query});
            },
        },
    ];

    if (canSendInvoice(allPolicies, email) || hasInvoiceReports()) {
        typeMenuItems.push({
            translationPath: 'workspace.common.invoices',
            type: CONST.SEARCH.DATA_TYPES.INVOICE,
            icon: Expensicons.InvoiceGeneric,
            getRoute: (policyID?: string) => {
                const query = buildCannedSearchQuery({type: CONST.SEARCH.DATA_TYPES.INVOICE, status: CONST.SEARCH.STATUS.INVOICE.ALL, policyID});
                return ROUTES.SEARCH_ROOT.getRoute({query});
            },
        });
    }

    typeMenuItems.push({
        translationPath: 'travel.trips',
        type: CONST.SEARCH.DATA_TYPES.TRIP,
        icon: Expensicons.Suitcase,
        getRoute: (policyID?: string) => {
            const query = buildCannedSearchQuery({type: CONST.SEARCH.DATA_TYPES.TRIP, status: CONST.SEARCH.STATUS.TRIP.ALL, policyID});
            return ROUTES.SEARCH_ROOT.getRoute({query});
        },
    });

    return typeMenuItems;
}

function createBaseSavedSearchMenuItem(item: SaveSearchItem, key: string, index: number, title: string, isFocused: boolean): SavedSearchMenuItem {
    return {
        key,
        title,
        hash: key,
        query: item.query,
        shouldShowRightComponent: true,
        focused: isFocused,
        pendingAction: item.pendingAction,
        disabled: item.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
        shouldIconUseAutoWidthStyle: true,
    };
}

/**
 * Whether to show the empty state or not
 */
function shouldShowEmptyState(isDataLoaded: boolean, dataLength: number, type: SearchDataTypes) {
    return !isDataLoaded || dataLength === 0 || !Object.values(CONST.SEARCH.DATA_TYPES).includes(type);
}

function isSearchDataLoaded(currentSearchResults: SearchResults | undefined, lastNonEmptySearchResults: SearchResults | undefined, queryJSON: SearchQueryJSON | undefined) {
    const searchResults = currentSearchResults?.data ? currentSearchResults : lastNonEmptySearchResults;
    const {status} = queryJSON ?? {};
    const isDataLoaded =
        searchResults?.data !== undefined && searchResults?.search?.type === queryJSON?.type && Array.isArray(status)
            ? searchResults?.search?.status === status.join(',')
            : searchResults?.search?.status === status;

    return isDataLoaded;
}

export {
    getListItem,
    getSections,
    getShouldShowMerchant,
    getSortedSections,
    isReportListItemType,
    isSearchResultsEmpty,
    isTransactionListItemType,
    isReportActionListItemType,
    shouldShowYear,
    getExpenseTypeTranslationKey,
    getOverflowMenu,
    isCorrectSearchUserName,
    isReportActionEntry,
    isTaskListItemType,
    getAction,
    createTypeMenuItems,
    createBaseSavedSearchMenuItem,
    shouldShowEmptyState,
    compareValues,
    isSearchDataLoaded,
};
export type {SavedSearchMenuItem, SearchTypeMenuItem};
