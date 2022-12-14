import { koteStorage, koteSquires } from '@/config/constants/contracts'
import * as subgraphService from '@/services/subgraph.service'
import * as socketService from '@/services/socket.service'
import getContract from '@/utils/getContract'

const squiresModule = {
  namespaced: true,
  state: {
    approved: false,
    loading: false,
    squiresDeposited: [],
    squiresToDeposit: [],
    squiresIdToWithdraw: [],
    loot: [],
    isRestart: false,
  },
  getters: {},
  mutations: {
    setApproved(state, status) {
      state.approved = status
    },
    setLoading(state, status) {
      state.loading = status
    },
    setSquiresDeposited(state, payload) {
      state.squiresDeposited = payload
    },
    setSquiresToDeposit(state, payload) {
      state.squiresToDeposit = payload
    },
    setSquiresIdToWithdraw(state, payload) {
      state.squiresIdToWithdraw = payload
    },
    setLoot(state, payload) {
      state.loot = payload
    },
    setIsRestart(state, status) {
      state.isRestart = status
    },
  },
  actions: {
    async getApproved({ rootState, commit }) {
      try {
        const squiresContract = getContract(rootState.web3.library, koteSquires.abi, koteSquires.address)
        const approvedStatus = await squiresContract.methods.isApprovedForAll(rootState.web3.account, koteStorage.address).call()
        commit('setApproved', approvedStatus)
        console.log('setApproved:', approvedStatus)
      } catch (error) {
        console.log(error)
        throw new Error(error)
      }
    },
    async approveSquiresContract({ rootState, commit }) {
      commit('setLoading', true)
      try {
        const squiresContract = getContract(rootState.web3.library, koteSquires.abi, koteSquires.address)
        await squiresContract.methods.setApprovalForAll(koteStorage.address, true).send({ from: rootState.web3.account })
        commit('setApproved', true)
        console.log('setApproved:', true)
        commit('setLoading', false)
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
    async getSquiresToDeposit({ rootState, commit }) {
      commit('setLoading', true)
      commit('setSquiresToDeposit', [])
      try {
        const pullGraph = await subgraphService.getSquiresToDepositBySubgraph(rootState.web3.account)
        commit(
          'setSquiresToDeposit',
          pullGraph.sort((a, b) => a.id - b.id),
        )
        commit('setLoading', false)
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
    async depositSquires({ rootState, state, commit }, selectedSquiresId) {
      commit('setLoading', true)
      const koteStorageContract = getContract(rootState.web3.library, koteStorage.abi, koteStorage.address)
      const _contractAddress = new Array(selectedSquiresId.length).fill(koteSquires.address)
      const _id = selectedSquiresId.map(squireId => Number(squireId))
      const _amount = new Array(selectedSquiresId.length).fill(1)

      try {
        await koteStorageContract.methods.depositItems(_contractAddress, _id, _amount).send({ from: rootState.web3.account })
        let squiresToDeposit = state.squiresToDeposit
        selectedSquiresId.forEach(squireId => {
          squiresToDeposit = squiresToDeposit.filter(squire => squire.id !== squireId)
        })
        commit('setSquiresToDeposit', squiresToDeposit)
        console.log('setSquiresToDeposit:', squiresToDeposit)
        commit('setLoading', false)
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
    getSquiresNoneQuesting({ rootState, commit }) {
      commit('setLoading', true)
      commit('setSquiresDeposited', [])
      setTimeout(() => {
        const squiresDepositedNQ = rootState.items.squires.filter(squire => squire.quest === 'None')
        commit(
          'setSquiresDeposited',
          squiresDepositedNQ.sort((a, b) => a.tokenId - b.tokenId),
        )
        commit('setLoading', false)
      }, 500)
    },
    getSquiresQuesting({ rootState, commit }, questType) {
      commit('setLoading', true)
      commit('setSquiresDeposited', [])
      setTimeout(() => {
        const squiresDepositedQ = rootState.items.squires.filter(squire => squire.quest === questType)
        commit(
          'setSquiresDeposited',
          squiresDepositedQ.sort((a, b) => a.tokenId - b.tokenId),
        )
        commit('setLoading', false)
      }, 500)
    },
    async startQuest({ rootState, commit }, { questType, selectedSquiresId }) {
      commit('setLoading', true)
      try {
        await socketService.startQuest(rootState.socket.socketInstance, rootState.web3.library, rootState.web3.account, questType, selectedSquiresId)
        let squiresDepositedNQ = rootState.items.squires.filter(squire => squire.quest === 'None')
        selectedSquiresId.forEach(squireId => {
          squiresDepositedNQ = squiresDepositedNQ.filter(squire => squire.tokenId !== squireId)
        })
        commit(
          'setSquiresDeposited',
          squiresDepositedNQ.sort((a, b) => a.tokenId - b.tokenId),
        )
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
    async finishQuest({ rootState, commit }, { questType, selectedSquiresId }) {
      commit('setLoading', true)
      try {
        await socketService.finishQuest(rootState.socket.socketInstance, rootState.web3.library, rootState.web3.account, selectedSquiresId)
        let squiresDepositedQuesting = rootState.items.squires.filter(squire => squire.quest === questType)
        selectedSquiresId.forEach(squireId => {
          squiresDepositedQuesting = squiresDepositedQuesting.filter(squire => squire.tokenId !== squireId)
        })
        commit(
          'setSquiresDeposited',
          squiresDepositedQuesting.sort((a, b) => a.tokenId - b.tokenId),
        )
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
    requestWithdrawOrders({ rootState, commit }) {
      commit('setLoading', true)
      try {
        socketService.requestWithdrawOrders(rootState.socket.socketInstance)
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
    async withdrawSquires({ rootState, state, commit }, withdrawOrders) {
      console.log('withdraw squires:', withdrawOrders)
      console.log('selected withdraw squires:', state.squiresIdToWithdraw)
      let squiresToWithdraw = []
      state.squiresIdToWithdraw.forEach(squireId => {
        withdrawOrders.forEach(squireToWithdraw => {
          if (squireToWithdraw.squire.tokenId === squireId)
            squiresToWithdraw.push(Object.assign({ ...squireToWithdraw.squire }, { signature: squireToWithdraw.signature }))
        })
      })
      const koteStorageContract = getContract(rootState.web3.library, koteStorage.abi, koteStorage.address)
      const _id = squiresToWithdraw.map(squire => Number(squire.tokenId))
      const _strength = squiresToWithdraw.map(squire => squire.strength)
      const _luck = squiresToWithdraw.map(squire => squire.luck)
      const _wisdom = squiresToWithdraw.map(squire => squire.wisdom)
      const _faith = squiresToWithdraw.map(squire => squire.faith)
      const _nonce = squiresToWithdraw.map(squire => squire.depositednonce)
      const signature = squiresToWithdraw.map(squire => squire.signature)
      try {
        await koteStorageContract.methods
          .withdrawManySquire(_id, _strength, _luck, _wisdom, _faith, _nonce, signature)
          .send({ from: rootState.web3.account })
        let squiresDeposited = state.squiresDeposited
        state.squiresIdToWithdraw.forEach(squireId => {
          squiresDeposited = squiresDeposited.filter(squire => squire.tokenId !== squireId)
        })
        commit(
          'setSquiresDeposited',
          squiresDeposited.sort((a, b) => a.tokenId - b.tokenId),
        )
        commit('setLoading', false)
      } catch (error) {
        console.log(error)
        commit('setLoading', false)
      }
    },
  },
}
export default squiresModule
