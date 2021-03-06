import React, { Component } from 'react';
import { View, TouchableOpacity, Text, FlatList, RefreshControl, LayoutAnimation } from 'react-native';
import {
  BlueText,
  BlueTransactionOnchainIcon,
  ManageFundsBigButton,
  BlueLoading,
  SafeBlueArea,
  WalletsCarousel,
  BlueTransactionIncommingIcon,
  BlueTransactionOutgoingIcon,
  BlueTransactionPendingIcon,
  BlueTransactionOffchainIcon,
  BlueSendButtonIcon,
  BlueReceiveButtonIcon,
  BlueList,
  BlueListItem,
  BlueHeaderDefaultMain,
} from '../../BlueComponents';
import { Icon } from 'react-native-elements';
import PropTypes from 'prop-types';
import { LightningCustodianWallet } from '../../class/lightning-custodian-wallet';
const BigNumber = require('bignumber.js');
let EV = require('../../events');
let A = require('../../analytics');
/** @type {AppStorage} */
let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
const customLayoutSpringAnimation = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.spring,
    property: LayoutAnimation.Properties.scaleXY,
    springDamping: 0.7,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.7,
  },
  delete: {
    type: LayoutAnimation.Types.spring,
    property: LayoutAnimation.Properties.scaleXY,
    springDamping: 0.7,
  },
};

export default class WalletsList extends Component {
  static navigationOptions = ({ navigation }) => ({
    headerStyle: {
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 0,
    },
    headerRight: (
      <TouchableOpacity style={{ marginHorizontal: 16 }} onPress={() => navigation.navigate('Settings')}>
        <Icon name="kebab-horizontal" size={22} type="octicon" color={BlueApp.settings.foregroundColor} />
      </TouchableOpacity>
    ),
  });

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
    };
    EV(EV.enum.WALLETS_COUNT_CHANGED, this.refreshFunction.bind(this));
    EV(EV.enum.TRANSACTIONS_COUNT_CHANGED, this.refreshTransactions.bind(this));
  }

  async componentDidMount() {
    this.refreshFunction();
  } // end of componendDidMount

  /**
   * Forcefully fetches TXs and balance for lastSnappedTo (i.e. current) wallet
   */
  refreshTransactions() {
    this.setState(
      {
        isTransactionsLoading: true,
      },
      async function() {
        let that = this;
        setTimeout(async function() {
          // more responsive
          let noErr = true;
          try {
            await BlueApp.fetchWalletBalances(that.lastSnappedTo || 0);
            let start = +new Date();
            await BlueApp.fetchWalletTransactions(that.lastSnappedTo || 0);
            let end = +new Date();
            console.log('tx took', (end - start) / 1000, 'sec');
          } catch (err) {
            noErr = false;
            console.warn(err);
          }
          if (noErr) await BlueApp.saveToDisk(); // caching

          that.refreshFunction();
        }, 1);
      },
    );
  }

  /**
   * Redraws the screen
   */
  refreshFunction() {
    if (BlueApp.getBalance() !== 0) {
      A(A.ENUM.GOT_NONZERO_BALANCE);
    }

    setTimeout(() => {
      console.log('refreshFunction()');
      let showSend = false;
      let showReceive = false;
      let showManageFundsBig = false;
      let showManageFundsSmallButton = false;
      let wallets = BlueApp.getWallets();
      let wallet = wallets[this.lastSnappedTo || 0];
      if (wallet) {
        showSend = wallet.allowSend();
        showReceive = wallet.allowReceive();
      }

      if (wallet && wallet.type === new LightningCustodianWallet().type && !showSend) {
        showManageFundsBig = true;
        showManageFundsSmallButton = false;
      }

      if (wallet && wallet.type === new LightningCustodianWallet().type && wallet.getBalance() > 0) {
        showManageFundsSmallButton = true;
      }

      this.setState({
        isLoading: false,
        isTransactionsLoading: false,
        showReceiveButton: showReceive,
        showSendButton: showSend,
        showManageFundsBigButton: showManageFundsBig,
        showManageFundsSmallButton,
        dataSource: BlueApp.getTransactions(this.lastSnappedTo || 0),
      });
    }, 1);
  }

  txMemo(hash) {
    if (BlueApp.tx_metadata[hash] && BlueApp.tx_metadata[hash]['memo']) {
      return BlueApp.tx_metadata[hash]['memo'];
    }
    return '';
  }

  handleClick(index) {
    console.log('cick', index);
    let wallet = BlueApp.wallets[index];
    if (wallet) {
      this.props.navigation.navigate('WalletDetails', {
        address: wallet.getAddress(), // either one of them will work
        secret: wallet.getSecret(),
      });
    } else {
      // if its out of index - this must be last card with incentive to create wallet
      this.props.navigation.navigate('AddWallet');
    }
  }

  onSnapToItem(index) {
    console.log('onSnapToItem', index);
    this.lastSnappedTo = index;
    LayoutAnimation.configureNext(customLayoutSpringAnimation);
    this.setState({
      isLoading: false,
      showReceiveButton: false,
      showManageFundsBigButton: false,
      showManageFundsSmallButton: false,
      showSendButton: false,
      dataSource: BlueApp.getTransactions(index),
    });

    if (index < BlueApp.getWallets().length) {
      // do not show for last card

      let showSend = false;
      let showReceive = false;
      let showManageFundsBig = false;
      let wallets = BlueApp.getWallets();
      let wallet = wallets[this.lastSnappedTo || 0];
      if (wallet) {
        showSend = wallet.allowSend();
        showReceive = wallet.allowReceive();
      }
      console.log({ showSend });
      let showManageFundsSmallButton = true;
      if (wallet && wallet.type === new LightningCustodianWallet().type && !showSend) {
        showManageFundsBig = true;
        showManageFundsSmallButton = false;
      }

      if (wallet && wallet.type === new LightningCustodianWallet().type) {
      } else {
        showManageFundsSmallButton = false;
      }

      console.log({ showManageFundsBig });

      LayoutAnimation.configureNext(customLayoutSpringAnimation);
      this.setState({
        showReceiveButton: showReceive,
        showManageFundsBigButton: showManageFundsBig,
        showManageFundsSmallButton,
        showSendButton: showSend,
      });
    }

    // now, lets try to fetch balance and txs for this wallet in case it has changed
    this.lazyRefreshWallet(index);
  }

  isLightning() {
    let w = BlueApp.getWallets()[this.lastSnappedTo || 0];
    if (w && w.type === new LightningCustodianWallet().type) {
      return true;
    }

    return false;
  }

  /**
   * Decides whether wallet with such index shoud be refreshed,
   * refreshes if yes and redraws the screen
   * @param index {Integer} Index of the wallet.
   * @return {Promise.<void>}
   */
  async lazyRefreshWallet(index) {
    /** @type {Array.<AbstractWallet>} wallets */
    let wallets = BlueApp.getWallets();
    if (!wallets[index]) {
      return;
    }
    let oldBalance = wallets[index].getBalance();
    let noErr = true;
    let didRefresh = false;

    try {
      if (wallets && wallets[index] && wallets[index].timeToRefreshBalance()) {
        console.log('snapped to, and now its time to refresh wallet #', index);
        await wallets[index].fetchBalance();
        if (oldBalance !== wallets[index].getBalance() || wallets[index].getUnconfirmedBalance() !== 0) {
          console.log('balance changed, thus txs too');
          // balance changed, thus txs too
          await wallets[index].fetchTransactions();
          this.refreshFunction();
          didRefresh = true;
        } else if (wallets[index].timeToRefreshTransaction()) {
          console.log(wallets[index].getLabel(), 'thinks its time to refresh TXs');
          await wallets[index].fetchTransactions();
          if (wallets[index].fetchPendingTransactions) {
            await wallets[index].fetchPendingTransactions();
          }
          this.refreshFunction();
          didRefresh = true;
        } else {
          console.log('balance not changed');
        }
      }
    } catch (Err) {
      noErr = false;
      console.warn(Err);
    }

    if (noErr && didRefresh) {
      await BlueApp.saveToDisk(); // caching
    }
  }

  _keyExtractor = (item, index) => index.toString();

  render() {
    const { navigate } = this.props.navigation;

    if (this.state.isLoading) {
      return <BlueLoading />;
    }

    return (
      <SafeBlueArea>
        <BlueHeaderDefaultMain leftText={loc.wallets.list.title} onNewWalletPress={() => this.props.navigation.navigate('AddWallet')} />
        <WalletsCarousel
          data={BlueApp.getWallets().concat(false)}
          handleClick={index => {
            this.handleClick(index);
          }}
          onSnapToItem={index => {
            this.onSnapToItem(index);
          }}
        />

        {(() => {
          if (this.state.showManageFundsSmallButton) {
            return (
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', right: 10, flexDirection: 'row' }}
                onPress={() => {
                  let walletIndex = this.lastSnappedTo || 0;

                  let c = 0;
                  for (let w of BlueApp.getWallets()) {
                    if (c++ === walletIndex) {
                      console.log('navigating to secret ', w.getSecret());
                      navigate('ManageFunds', { fromSecret: w.getSecret() });
                    }
                  }
                }}
              >
                <BlueText style={{ fontWeight: '600', fontSize: 16 }}>{loc.lnd.title}</BlueText>
                <Icon
                  style={{ position: 'relative' }}
                  name="link"
                  type="font-awesome"
                  size={14}
                  color={BlueApp.settings.foregroundColor}
                  iconStyle={{ left: 5, transform: [{ rotate: '90deg' }] }}
                />
              </TouchableOpacity>
            );
          }
        })()}

        {(() => {
          return (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', height: 50 }}>
                <Text
                  style={{
                    paddingLeft: 15,
                    paddingTop: 15,
                    fontWeight: 'bold',
                    fontSize: 24,
                    color: BlueApp.settings.foregroundColor,
                  }}
                >
                  {loc.transactions.list.title}
                </Text>
              </View>

              <View
                style={{
                  top: 20,
                }}
              >
                {(() => {
                  if (BlueApp.getTransactions(this.lastSnappedTo || 0).length === 0) {
                    return (
                      <View>
                        <Text
                          style={{
                            fontSize: 18,
                            color: '#9aa0aa',
                            textAlign: 'center',
                          }}
                        >
                          {(this.isLightning() &&
                            'Lightning wallet should be used for your daily\ntransactions. Fees are unfairly cheap and\nspeed is blazing fast.') ||
                            loc.wallets.list.empty_txs1}
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            color: '#9aa0aa',
                            textAlign: 'center',
                          }}
                        >
                          {(this.isLightning() && '\nTo start using it tap on "manage funds"\nand topup your balance') ||
                            loc.wallets.list.empty_txs2}
                        </Text>
                      </View>
                    );
                  }
                })()}
              </View>

              <View style={{ flex: 1 }}>
                <BlueList>
                  <FlatList
                    refreshControl={
                      <RefreshControl onRefresh={() => this.refreshTransactions()} refreshing={this.state.isTransactionsLoading} />
                    }
                    data={this.state.dataSource}
                    extraData={this.state.dataSource}
                    keyExtractor={this._keyExtractor}
                    renderItem={rowData => {
                      return (
                        <BlueListItem
                          avatar={(() => {
                            // is it lightning refill tx?
                            if (rowData.item.category === 'receive' && rowData.item.confirmations < 3) {
                              return (
                                <View style={{ width: 25 }}>
                                  <BlueTransactionPendingIcon />
                                </View>
                              );
                            }

                            if (rowData.item.type && rowData.item.type === 'bitcoind_tx') {
                              return (
                                <View style={{ width: 25 }}>
                                  <BlueTransactionOnchainIcon />
                                </View>
                              );
                            }
                            if (rowData.item.type === 'paid_invoice') {
                              // is it lightning offchain payment?
                              return (
                                <View style={{ width: 25 }}>
                                  <BlueTransactionOffchainIcon />
                                </View>
                              );
                            }

                            if (!rowData.item.confirmations) {
                              return (
                                <View style={{ width: 25 }}>
                                  <BlueTransactionPendingIcon />
                                </View>
                              );
                            } else if (rowData.item.value < 0) {
                              return (
                                <View style={{ width: 25 }}>
                                  <BlueTransactionOutgoingIcon />
                                </View>
                              );
                            } else {
                              return (
                                <View style={{ width: 25 }}>
                                  <BlueTransactionIncommingIcon />
                                </View>
                              );
                            }
                          })()}
                          title={loc.transactionTimeToReadable(rowData.item.received)}
                          subtitle={
                            (rowData.item.confirmations < 7 ? loc.transactions.list.conf + ': ' + rowData.item.confirmations + ' ' : '') +
                            this.txMemo(rowData.item.hash) +
                            (rowData.item.memo || '')
                          }
                          onPress={() => {
                            if (rowData.item.hash) {
                              navigate('TransactionDetails', {
                                hash: rowData.item.hash,
                              });
                            }
                          }}
                          badge={{
                            value: 3,
                            textStyle: { color: 'orange' },
                            containerStyle: { marginTop: 0 },
                          }}
                          hideChevron
                          rightTitle={new BigNumber((rowData.item.value && rowData.item.value) || 0).div(100000000).toString()}
                          rightTitleStyle={{
                            fontWeight: '600',
                            fontSize: 16,
                            color: rowData.item.value / 100000000 < 0 ? BlueApp.settings.foregroundColor : '#37c0a1',
                          }}
                        />
                      );
                    }}
                  />
                </BlueList>
              </View>
            </View>
          );
        })()}
        <View
          style={{
            flexDirection: 'row',
            alignSelf: 'center',
            backgroundColor: 'transparent',
            position: 'absolute',
            bottom: 30,
            borderRadius: 15,
            overflow: 'hidden',
          }}
        >
          {(() => {
            if (this.state.showReceiveButton) {
              return (
                <BlueReceiveButtonIcon
                  onPress={() => {
                    let start = +new Date();
                    let walletIndex = this.lastSnappedTo || 0;
                    console.log('receiving on #', walletIndex);

                    let c = 0;
                    for (let w of BlueApp.getWallets()) {
                      if (c++ === walletIndex) {
                        console.log('found receiving address, secret=', w.getAddress(), ',', w.getSecret());
                        navigate('ReceiveDetails', { address: w.getAddress(), secret: w.getSecret() });
                        if (w.getAddress()) {
                          // EV(EV.enum.RECEIVE_ADDRESS_CHANGED, w.getAddress());
                        }
                      }
                    }
                    let end = +new Date();
                    console.log('took', (end - start) / 1000, 'sec');
                  }}
                />
              );
            }
          })()}

          {(() => {
            if (this.state.showSendButton) {
              return (
                <BlueSendButtonIcon
                  onPress={() => {
                    let walletIndex = this.lastSnappedTo || 0;

                    let c = 0;
                    for (let w of BlueApp.getWallets()) {
                      if (c++ === walletIndex) {
                        if (w.type === new LightningCustodianWallet().type) {
                          navigate('ScanLndInvoice', { fromSecret: w.getSecret() });
                        } else {
                          navigate('SendDetails', { fromAddress: w.getAddress(), fromSecret: w.getSecret() });
                        }
                      }
                    }
                  }}
                />
              );
            }
          })()}

          {(() => {
            if (this.state.showManageFundsBigButton) {
              return (
                <ManageFundsBigButton
                  onPress={() => {
                    let walletIndex = this.lastSnappedTo || 0;

                    let c = 0;
                    for (let w of BlueApp.getWallets()) {
                      if (c++ === walletIndex) {
                        console.log('navigating to secret ', w.getSecret());
                        navigate('ManageFunds', { fromSecret: w.getSecret() });
                      }
                    }
                  }}
                />
              );
            }
          })()}
        </View>
      </SafeBlueArea>
    );
  }
}

WalletsList.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
  }),
};
