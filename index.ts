// Ponto de entrada. A tarefa de ações das notificações (Android) precisa ser
// definida no escopo do módulo ANTES do app carregar, para funcionar com o app encerrado.
import './src/notifications/backgroundTask';
import 'expo-router/entry';
