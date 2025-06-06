/* eslint-disable @typescript-eslint/naming-convention */
import {renderHook} from '@testing-library/react-native';
import useSearchHighlightAndScroll from '@hooks/useSearchHighlightAndScroll';
import type {UseSearchHighlightAndScroll} from '@hooks/useSearchHighlightAndScroll';
import {search} from '@libs/actions/Search';
import CONST from '@src/CONST';

jest.mock('@libs/actions/Search');
jest.mock('@src/components/ConfirmedRoute.tsx');

afterEach(() => {
    jest.clearAllMocks();
});

describe('useSearchHighlightAndScroll', () => {
    it('should trigger Search when transactionIDs list change', () => {
        const initialProps: UseSearchHighlightAndScroll = {
            searchResults: {
                data: {personalDetailsList: {}},
                search: {
                    columnsToShow: {
                        shouldShowCategoryColumn: true,
                        shouldShowTagColumn: true,
                        shouldShowTaxColumn: true,
                    },
                    hasMoreResults: false,
                    hasResults: true,
                    offset: 0,
                    status: 'all',
                    type: 'expense',
                    isLoading: false,
                },
            },
            transactions: {
                transactions_1: {
                    amount: -100,
                    bank: '',
                    billable: false,
                    cardID: 0,
                    cardName: 'Cash Expense',
                    cardNumber: '',
                    category: '',
                    comment: {
                        comment: '',
                    },
                    created: '2025-01-08',
                    currency: 'ETB',
                    filename: 'w_c989c343d834d48a4e004c38d03c90bff9434768.png',
                    inserted: '2025-01-08 15:35:32',
                    managedCard: false,
                    merchant: 'g',
                    modifiedAmount: 0,
                    modifiedCreated: '',
                    modifiedCurrency: '',
                    modifiedMerchant: '',
                    originalAmount: 0,
                    originalCurrency: '',
                    parentTransactionID: '',
                    posted: '',
                    receipt: {
                        receiptID: 7409094723954473,
                        state: CONST.IOU.RECEIPT_STATE.SCAN_COMPLETE,
                        source: 'https://www.expensify.com/receipts/w_c989c343d834d48a4e004c38d03c90bff9434768.png',
                    },
                    reimbursable: true,
                    reportID: '2309609540437471',
                    status: 'Posted',
                    tag: '',
                    transactionID: '1',
                    hasEReceipt: false,
                },
            },
            previousTransactions: {
                transactions_1: {
                    amount: -100,
                    bank: '',
                    billable: false,
                    cardID: 0,
                    cardName: 'Cash Expense',
                    cardNumber: '',
                    category: '',
                    comment: {
                        comment: '',
                    },
                    created: '2025-01-08',
                    currency: 'ETB',
                    filename: 'w_c989c343d834d48a4e004c38d03c90bff9434768.png',
                    inserted: '2025-01-08 15:35:32',
                    managedCard: false,
                    merchant: 'g',
                    modifiedAmount: 0,
                    modifiedCreated: '',
                    modifiedCurrency: '',
                    modifiedMerchant: '',
                    originalAmount: 0,
                    originalCurrency: '',
                    parentTransactionID: '',
                    posted: '',
                    receipt: {
                        receiptID: 7409094723954473,
                        state: CONST.IOU.RECEIPT_STATE.SCAN_COMPLETE,
                        source: 'https://www.expensify.com/receipts/w_c989c343d834d48a4e004c38d03c90bff9434768.png',
                    },
                    reimbursable: true,
                    reportID: '2309609540437471',
                    status: 'Posted',
                    tag: '',
                    transactionID: '1',
                    hasEReceipt: false,
                },
            },
            reportActions: {
                reportActions_209647397999267: {
                    1: {
                        actionName: CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE,
                        reportActionID: '1',
                        created: '',
                    },
                },
            },
            previousReportActions: {
                reportActions_209647397999267: {
                    1: {
                        actionName: CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE,
                        reportActionID: '1',
                        created: '',
                    },
                },
            },
            queryJSON: {
                type: 'expense',
                status: 'all',
                sortBy: 'date',
                sortOrder: 'desc',
                filters: {operator: 'and', left: 'tag', right: ''},
                inputQuery: 'type:expense status:all sortBy:date sortOrder:desc',
                flatFilters: [],
                hash: 243428839,
                recentSearchHash: 422547233,
            },
            offset: 0,
        };
        const changedProp: UseSearchHighlightAndScroll = {
            ...initialProps,
            transactions: {
                transactions_2: {
                    amount: -100,
                    bank: '',
                    billable: false,
                    cardID: 0,
                    cardName: 'Cash Expense',
                    cardNumber: '',
                    category: '',
                    comment: {
                        comment: '',
                    },
                    created: '2025-01-08',
                    currency: 'ETB',
                    filename: 'w_c989c343d834d48a4e004c38d03c90bff9434768.png',
                    inserted: '2025-01-08 15:35:32',
                    managedCard: false,
                    merchant: 'g',
                    modifiedAmount: 0,
                    modifiedCreated: '',
                    modifiedCurrency: '',
                    modifiedMerchant: '',
                    originalAmount: 0,
                    originalCurrency: '',
                    parentTransactionID: '',
                    posted: '',
                    receipt: {
                        receiptID: 7409094723954473,
                        state: CONST.IOU.RECEIPT_STATE.SCAN_COMPLETE,
                        source: 'https://www.expensify.com/receipts/w_c989c343d834d48a4e004c38d03c90bff9434768.png',
                    },
                    reimbursable: true,
                    reportID: '2309609540437471',
                    status: 'Posted',
                    tag: '',
                    transactionID: '2',
                    hasEReceipt: false,
                },
            },
        };

        const {rerender} = renderHook((prop: UseSearchHighlightAndScroll) => useSearchHighlightAndScroll(prop), {
            initialProps,
        });
        expect(search).not.toHaveBeenCalled();

        // When the transaction ids list change though it has the same length as previous value
        rerender(changedProp);

        // Then Search will be triggered.
        expect(search).toHaveBeenCalled();
    });

    it('should trigger Search when report actions change', () => {
        const initialProps: UseSearchHighlightAndScroll = {
            searchResults: {
                data: {personalDetailsList: {}},
                search: {
                    columnsToShow: {
                        shouldShowCategoryColumn: true,
                        shouldShowTagColumn: true,
                        shouldShowTaxColumn: true,
                    },
                    hasMoreResults: false,
                    hasResults: true,
                    offset: 0,
                    status: 'all',
                    type: 'expense',
                    isLoading: false,
                },
            },
            transactions: {},
            previousTransactions: {},
            reportActions: {
                reportActions_209647397999267: {
                    1: {
                        actionName: CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE,
                        reportActionID: '1',
                        created: '',
                    },
                },
            },
            previousReportActions: {
                reportActions_209647397999267: {
                    1: {
                        actionName: CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE,
                        reportActionID: '1',
                        created: '',
                    },
                },
            },
            queryJSON: {
                type: 'expense',
                status: 'all',
                sortBy: 'date',
                sortOrder: 'desc',
                filters: {operator: 'and', left: 'tag', right: ''},
                inputQuery: 'type:expense status:all sortBy:date sortOrder:desc',
                flatFilters: [],
                hash: 243428839,
                recentSearchHash: 422547233,
            },
            offset: 0,
        };

        const changedProps: UseSearchHighlightAndScroll = {
            ...initialProps,
            reportActions: {
                reportActions_209647397999268: {
                    1: {
                        actionName: CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE,
                        reportActionID: '1',
                        created: '',
                    },
                    2: {
                        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
                        reportActionID: '2',
                        created: '',
                    },
                },
            },
        };

        const {rerender} = renderHook((props: UseSearchHighlightAndScroll) => useSearchHighlightAndScroll(props), {
            initialProps,
        });
        expect(search).not.toHaveBeenCalled();

        // When report actions change
        rerender(changedProps);

        // Then Search will be triggered
        expect(search).toHaveBeenCalled();
    });
});
